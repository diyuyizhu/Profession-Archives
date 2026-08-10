<script setup lang="ts">
/**
 * 投递详情档案（看板卡片点击进入）：
 * - 全字段查看 + 编辑（含总轮数 / 重要性 / 邮箱往来）
 * - 状态操作（推进 / 标记终态）
 * - 关联内容：面试记录、复盘、沉淀的面经、归档入口
 */
import type { Application, ApplicationPayload, ApplicationStatus, InterviewToolKind } from '@pa/shared'
import { APPLY_METHOD_LABELS } from '@pa/shared'
import { nextStage, statusMeta } from '@pa/shared/application'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ApplicationEditModal from '@/components/application/ApplicationEditModal.vue'
import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { transitionTargets, useApplicationStore } from '@/stores/application'
import { useArchivesStore } from '@/stores/archives'
import { useInterviewStore } from '@/stores/interview'
import { useInterviewToolsStore } from '@/stores/interviewTools'
import { useQuestionBankStore } from '@/stores/questionBank'

const route = useRoute()
const router = useRouter()
const appStore = useApplicationStore()
const interviewStore = useInterviewStore()
const questionBank = useQuestionBankStore()
const archivesStore = useArchivesStore()
const toolsStore = useInterviewToolsStore()

const app = computed<Application | null>(() =>
  appStore.applications.find((a) => a.id === String(route.params.id)) ?? null,
)

/** 就地编辑的 email_thread（随投递切换同步/复位） */
const emailDraft = ref('')
const emailSaved = ref(false)
let emailTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => app.value?.id,
  () => {
    emailDraft.value = app.value?.email_thread ?? ''
  },
  { immediate: true },
)

const interviews = computed(() =>
  app.value ? interviewStore.interviewsOf(app.value.id).sort((a, b) => b.round - a.round) : [],
)
const reflections = computed(() =>
  app.value
    ? interviewStore.reflections
        .filter((r) => r.application_id === app.value!.id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    : [],
)
/** 该投递面试沉淀的题库题目 */
const bankItems = computed(() => {
  if (!app.value) return []
  const ivIds = new Set(interviewStore.interviewsOf(app.value.id).map((i) => i.id))
  return questionBank.items.filter((q) => q.interview_id && ivIds.has(q.interview_id))
})

const editing = ref(false)
const saveError = ref('')

/* ── 面试准备：选择面试软件 ── */
const selectedToolId = ref('')
const showToolManager = ref(false)
const newToolName = ref('')
const newToolKind = ref<InterviewToolKind>('video')
const newToolUrl = ref('')

function addTool(): void {
  if (!newToolName.value.trim()) return
  try {
    toolsStore.addTool(newToolName.value, newToolKind.value, newToolUrl.value)
    newToolName.value = ''
    newToolUrl.value = ''
  } catch {
    saveError.value = '保存失败：本地存储不可用'
  }
}

/** 打开面试工具链接（新窗口） */
function openToolUrl(url?: string): void {
  if (url) window.open(url, '_blank', 'noopener')
}

/* ── 面试录制（屏幕 + 可选麦克风 → 下载 + 归档） ── */
const recording = ref(false)
const recordSeconds = ref(0)
const recordError = ref('')
const recordNote = ref('')
/** 是否同时录麦克风（与屏幕混音） */
const recordMic = ref(true)
let mediaRecorder: MediaRecorder | null = null
let recordStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let chunks: Blob[] = []
let recordTimer: number | undefined

/** 是否运行在桌面版（Tauri）：可用系统级录制（屏幕 + 系统声音） */
const isDesktop = computed(() =>
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__),
)

function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke(c: string, a?: unknown): Promise<unknown> } })
    .__TAURI_INTERNALS__
  if (!internals?.invoke) return Promise.reject(new Error('不在桌面版环境中'))
  return internals.invoke(cmd, args)
}

async function startRecording(): Promise<void> {
  if (!app.value) return
  recordError.value = ''
  recording.value = true
  recordSeconds.value = 0
  recordTimer = window.setInterval(() => recordSeconds.value++, 1000)

  // 桌面版优先系统级录制（ffmpeg 屏幕 + 系统声音）；ffmpeg 缺失时自动回退网页录屏
  if (isDesktop.value) {
    try {
      await tauriInvoke('start_system_recording', {
        label: `${app.value.company}-面试-${new Date().toISOString().slice(0, 10)}`,
      })
      return
    } catch (e) {
      stopRecordingTimer()
      recording.value = false
      recordError.value = `系统级录制不可用（${e}），已回退网页录屏（仅标签页声音+麦克风）`
    }
  }

  // 网页降级：屏幕（含标签页声音）+ 可选麦克风混音
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    let micStream: MediaStream | null = null
    if (recordMic.value) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        // 麦克风不可用则仅录画面/标签页声音
      }
    }
    recordStream = displayStream
    if (micStream) {
      audioContext = new AudioContext()
      const dest = audioContext.createMediaStreamDestination()
      const connect = (track: MediaStreamTrack): void => {
        if (!audioContext) return
        const src = audioContext.createMediaStreamSource(new MediaStream([track]))
        src.connect(dest)
      }
      displayStream.getAudioTracks().forEach(connect)
      micStream.getAudioTracks().forEach(connect)
      recordStream = new MediaStream([...displayStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
    }
    mediaRecorder = new MediaRecorder(recordStream)
    chunks = []
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    mediaRecorder.onstop = onRecordingStop
    mediaRecorder.start()
  } catch {
    stopRecordingTimer()
    recording.value = false
    recordError.value = '无法开始录屏：请使用 Chrome/Edge，并允许屏幕共享；或已取消选择'
  }
}

function stopRecordingTimer(): void {
  if (recordTimer) window.clearInterval(recordTimer)
  recordTimer = undefined
}

function stopRecording(): void {
  if (!recording.value) return
  stopRecordingTimer()
  recording.value = false

  // 桌面版：停止系统录制 → 归档（文件已存到桌面端 recordings 目录）
  if (isDesktop.value) {
    void tauriInvoke('stop_system_recording')
      .then(() => {
        if (!app.value) return
        const date = new Date().toISOString().slice(0, 10)
        try {
          archivesStore.addItem({
            application_id: app.value.id,
            kind: 'recording',
            title: `面试录像（系统级 · ${new Date().toLocaleString('zh-CN')}）`,
            file_name: `${app.value.company}-面试-${date}.mp4`,
            occurred_at: date,
          })
          recordNote.value = '系统级录像（含系统声音）已保存到桌面端 recordings 目录并归档'
        } catch {
          saveError.value = '归档失败：本地存储不可用'
        }
        setTimeout(() => (recordNote.value = ''), 4000)
      })
      .catch((e) => {
        recordError.value = `停止录制失败：${e}`
      })
    return
  }

  // 网页降级
  try {
    mediaRecorder?.stop()
  } finally {
    recordStream?.getTracks().forEach((t) => t.stop())
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }
}

function onRecordingStop(): void {
  const blob = new Blob(chunks, { type: 'video/webm' })
  const seconds = recordSeconds.value
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `${app.value?.company ?? '面试'}-录像-${date}-${seconds}s.webm`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)

  // 归档到投递档案（本地保存视频文件，这里记录引用）
  if (app.value) {
    try {
      archivesStore.addItem({
        application_id: app.value.id,
        kind: 'recording',
        title: `面试录像（${new Date().toLocaleString('zh-CN')}）`,
        file_name: fileName,
        file_size: blob.size,
        duration: seconds,
        occurred_at: date,
      })
      recordNote.value = '录像已下载并归档到该投递档案'
    } catch {
      saveError.value = '归档失败：本地存储不可用'
    }
  }
  setTimeout(() => (recordNote.value = ''), 4000)
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  return m ? `${m}分${s % 60}秒` : `${s}秒`
}

function fmtSize(b: number | undefined): string {
  if (!b) return ''
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.round(b / 1024)}KB`
}

function removeArchive(id: string): void {
  archivesStore.removeItem(id)
}

/** 该投递的归档列表 */
const archives = computed(() =>
  app.value ? archivesStore.ofApplication(app.value.id) : [],
)

function canAdvance(a: Application): boolean {
  return nextStage(a.status, a.total_rounds ?? 3) !== null
}

function onAdvance(): void {
  if (!app.value) return
  try {
    appStore.advance(app.value.id)
  } catch {
    saveError.value = '保存失败：本地存储不可用或已满'
  }
}

function onTerminal(to: ApplicationStatus): void {
  if (!app.value) return
  let reason: string | undefined
  if (to === 'rejected') {
    const input = window.prompt(`标记拒绝。失败原因？`, app.value.reject_reason ?? '')
    if (input === null) return
    reason = input
  }
  try {
    appStore.transition(app.value.id, to, undefined, reason)
  } catch {
    saveError.value = '保存失败：本地存储不可用或已满'
  }
}

function saveEmail(): void {
  if (!app.value) return
  try {
    appStore.updateApplication(app.value.id, { email_thread: emailDraft.value })
    emailSaved.value = true
    clearTimeout(emailTimer)
    emailTimer = setTimeout(() => (emailSaved.value = false), 2500)
  } catch {
    saveError.value = '保存失败：本地存储不可用或已满'
  }
}

/** 保存编辑：显式构造字段（不含 status——状态机迁移走"推进/标记"），避免绕过事件日志 */
function onSaveEdit(payload: ApplicationPayload): void {
  if (!app.value) return
  appStore.updateApplication(app.value.id, {
    company: payload.company,
    title: payload.title,
    channel: payload.channel,
    url: payload.url,
    jd: payload.jd,
    tags: payload.tags,
    notes: payload.notes,
    total_rounds: payload.total_rounds,
    importance: payload.importance,
    email_thread: payload.email_thread,
    reject_reason: payload.reject_reason,
    applied_at: payload.applied_at,
  })
  editing.value = false
}

/** 打开编辑时同步 email 草稿 */
function openEdit(): void {
  if (app.value) {
    emailDraft.value = app.value.email_thread ?? ''
    editing.value = true
  }
}

/** 离开页面时清理录制（timer/媒体流/桌面端 ffmpeg），防止泄漏 */
onBeforeUnmount(() => {
  stopRecordingTimer()
  if (recording.value) {
    recording.value = false
    if (isDesktop.value) {
      void tauriInvoke('stop_system_recording').catch(() => undefined)
    } else {
      mediaRecorder?.stop()
      recordStream?.getTracks().forEach((t) => t.stop())
      void audioContext?.close().catch(() => undefined)
      audioContext = null
    }
  }
})
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <div v-if="app">
        <PageHeader :code="statusMeta(app.status, app.total_rounds).label" :title="app.title" :desc="app.company">
          <SecondaryButton @click="router.push('/tracking')">← 返回看板</SecondaryButton>
          <PrimaryButton @click="openEdit">编辑档案</PrimaryButton>
        </PageHeader>

        <!-- 状态操作 -->
        <section class="card-glass flex flex-wrap items-center gap-3 p-4" style="backdrop-filter: blur(28px) saturate(1.6)">
          <span
            class="rounded-full border px-3 py-1 text-[12.5px]"
            :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
          >
            {{ statusMeta(app.status, app.total_rounds).label }}
          </span>
          <span class="text-[12px] text-[rgba(245,249,254,0.45)]">
            共 {{ app.total_rounds ?? 3 }} 轮
          </span>
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <button
              v-if="canAdvance(app)"
              class="rounded-lg border border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.08)] px-3 py-1.5 text-[12px] font-medium text-[#32f08c]"
              @click="onAdvance"
            >
              推进 ▸
            </button>
            <button
              v-for="target in transitionTargets(app!.status, app!.total_rounds ?? 3).filter((s) => s !== app!.status)"
              :key="target"
              class="rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[12px] text-[rgba(245,249,254,0.6)] hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
              @click="onTerminal(target)"
            >
              标记{{ statusMeta(target, app!.total_rounds).label }}
            </button>
          </div>
        </section>

        <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <!-- 基本信息 -->
          <section class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">基本信息</div>
            <div class="space-y-2 text-[12.5px]">
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">渠道</span><span>{{ app.channel || '—' }}</span></div>
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">投递方式</span><span>{{ app.apply_method ? APPLY_METHOD_LABELS[app.apply_method] : '—' }}</span></div>
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">投递日期</span><span>{{ app.applied_at || '—' }}</span></div>
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">重要性</span><span class="text-[#fbbf24]">{{ app.importance ? '★'.repeat(app.importance) : '—' }}</span></div>
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">URL</span><a v-if="app.url" :href="app.url" target="_blank" rel="noopener" class="truncate text-[#38bdf8] hover:underline">{{ app.url }}</a><span v-else>—</span></div>
              <div class="flex justify-between gap-3"><span class="text-[rgba(245,249,254,0.4)]">标签</span><span>{{ app.tags.length ? app.tags.map((t) => '#' + t).join(' ') : '—' }}</span></div>
            </div>

            <!-- JD -->
            <details class="mt-4">
              <summary class="cursor-pointer text-[12px] font-medium text-[#32f08c]">JD 全文（点击展开）</summary>
              <pre class="mt-2 whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] p-3 text-[12px] leading-relaxed text-[rgba(245,249,254,0.6)]">{{ app.jd || '（无）' }}</pre>
            </details>
            <p v-if="app.notes" class="mt-3 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] p-3 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.6)]">{{ app.notes }}</p>

            <!-- 投递方式快捷动作 -->
            <div v-if="app.apply_method" class="mt-4 flex flex-wrap gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
              <RouterLink
                :to="{ path: '/tracking/resume', query: { app: app.id } }"
                class="rounded-lg border border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.06)] px-3 py-1.5 text-[12px] text-[#32f08c] no-underline hover:bg-[rgba(50,240,140,0.12)]"
              >
                📄 生成特化简历
              </RouterLink>
              <RouterLink v-if="app.apply_method === 'official_form'" to="/automation/plugin" class="rounded-lg border border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.06)] px-3 py-1.5 text-[12px] text-[#38bdf8] no-underline hover:bg-[rgba(56,189,248,0.12)]">
                🧩 插件填充
              </RouterLink>
              <RouterLink v-if="app.apply_method === 'email'" to="/tracking/collect" class="rounded-lg border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] px-3 py-1.5 text-[12px] text-[#a78bfa] no-underline hover:bg-[rgba(139,92,246,0.12)]">
                📧 邮箱导入
              </RouterLink>
            </div>
          </section>

          <!-- 邮箱往来 -->
          <section class="card-glass flex flex-col p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">邮箱往来（归档）</span>
              <span v-if="emailSaved" class="text-[11.5px] text-[#60f2bd]">✓ 已保存</span>
            </div>
            <textarea
              v-model="emailDraft"
              class="input-trae min-h-[180px] flex-1 resize-y py-3 text-[12.5px]"
              placeholder="粘贴该岗位的邮箱往来内容（约面邀请、回复、通知…）&#10;后续可接入邮箱自动填入"
            />
            <div class="mt-2 flex items-center justify-between">
              <span v-if="saveError" class="text-[11.5px] text-[#f87171]">{{ saveError }}</span>
              <span class="flex-1" />
              <SecondaryButton @click="saveEmail">保存邮箱归档</SecondaryButton>
            </div>
          </section>
        </div>

        <!-- 关联内容 -->
        <section class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <!-- 面试记录 -->
          <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">面试记录（{{ interviews.length }} 轮）</span>
              <RouterLink to="/interview" class="text-[12px] text-[#32f08c] no-underline hover:text-[#60f2bd]">去面试记录 →</RouterLink>
            </div>
            <div v-if="interviews.length" class="space-y-2">
              <div v-for="iv in interviews" :key="iv.id" class="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2">
                <span class="text-[12px] text-[rgba(245,249,254,0.7)]">第 {{ iv.round }} 轮 · {{ iv.occurred_at }}</span>
                <span class="text-[11.5px]" :class="iv.result === 'passed' ? 'text-[#32f08c]' : iv.result === 'failed' ? 'text-[#f87171]' : 'text-[#fbbf24]'">
                  {{ iv.result === 'passed' ? '通过' : iv.result === 'failed' ? '淘汰' : '待定' }}
                </span>
              </div>
            </div>
            <div v-else class="py-4 text-center text-[12px] text-[rgba(245,249,254,0.3)]">还没有面试记录</div>
          </div>

          <!-- 复盘 -->
          <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">复盘（{{ reflections.length }} 条）</span>
              <RouterLink to="/interview/review" class="text-[12px] text-[#32f08c] no-underline hover:text-[#60f2bd]">去 AI 复盘 →</RouterLink>
            </div>
            <div v-if="reflections.length" class="space-y-2">
              <div v-for="r in reflections" :key="r.id" class="rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] text-[rgba(245,249,254,0.35)]">{{ new Date(r.created_at).toLocaleDateString('zh-CN') }}</span>
                  <span class="text-[11px] text-[#38bdf8]">{{ r.highlights.length }} 亮点 · {{ r.improvements.length }} 待改进</span>
                </div>
                <ul class="mt-1.5 space-y-0.5 text-[12px] text-[rgba(245,249,254,0.6)]">
                  <li v-for="h in r.improvements.slice(0, 3)" :key="h">· {{ h }}</li>
                </ul>
              </div>
            </div>
            <div v-else class="py-4 text-center text-[12px] text-[rgba(245,249,254,0.3)]">还没有复盘</div>
          </div>

          <!-- 沉淀面经 -->
          <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">沉淀面经（{{ bankItems.length }} 题）</span>
              <RouterLink to="/interview/question-bank" class="text-[12px] text-[#32f08c] no-underline hover:text-[#60f2bd]">去面经题库 →</RouterLink>
            </div>
            <div v-if="bankItems.length" class="space-y-1.5">
              <div v-for="q in bankItems" :key="q.id" class="truncate text-[12px] text-[rgba(245,249,254,0.65)]">▸ {{ q.question }}</div>
            </div>
            <div v-else class="py-4 text-center text-[12px] text-[rgba(245,249,254,0.3)]">面试题目可沉淀到面经题库</div>
          </div>

          <!-- 面试准备 + 录制归档 -->
          <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">面试准备 · 录制归档</span>
              <button class="text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#32f08c]" @click="showToolManager = true">
                ⚙ 管理面试软件
              </button>
            </div>

            <!-- 选面试软件 + 开始录屏 -->
            <div v-if="!recording" class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <select v-model="selectedToolId" class="input-trae h-9 w-auto min-w-[150px] appearance-none text-[12.5px]">
                  <option value="" disabled>选择面试软件…</option>
                  <option v-for="t in toolsStore.tools" :key="t.id" :value="t.id">
                    {{ t.name }}（{{ toolsStore.TOOL_KIND_LABEL[t.kind] }}）
                  </option>
                </select>
                <button
                  v-if="toolsStore.tools.find((t) => t.id === selectedToolId)?.url"
                  class="text-[12px] text-[#38bdf8] hover:underline"
                  @click="openToolUrl(toolsStore.tools.find((t) => t.id === selectedToolId)!.url)"
                >
                  打开工具 ↗
                </button>
                <button
                  class="rounded-lg border border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.08)] px-3 py-1.5 text-[12px] font-medium text-[#32f08c]"
                  @click="startRecording"
                >
                  ● 开始录屏
                </button>
              </div>
              <label class="flex cursor-pointer items-center gap-2">
                <input v-model="recordMic" type="checkbox" class="h-4 w-4 accent-[#32f08c]" />
                <span class="text-[12px] text-[rgba(245,249,254,0.65)]">同时录制麦克风（与屏幕混音）</span>
              </label>
              <div v-if="isDesktop" class="text-[11px] text-[rgba(245,249,254,0.35)]">
                🖥 桌面版：<b class="text-[#32f08c]">系统级录制</b>（屏幕 + 系统声音），由桌面端 ffmpeg 完成
              </div>
              <div v-else class="text-[11px] text-[rgba(245,249,254,0.35)]">
                网页降级录制：只能录标签页声音 + 麦克风；要录<b class="text-[#fbbf24]">系统声音（对方扬声器）</b>请使用桌面版（Tauri）
              </div>
            </div>

            <!-- 录制中 -->
            <div v-else class="rounded-lg border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.06)] p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-[13px] font-medium text-[#f87171]">
                  ● 录制中 {{ fmtDuration(recordSeconds) }}
                </span>
                <button
                  class="rounded-lg border border-[rgba(248,113,113,0.5)] bg-[rgba(248,113,113,0.1)] px-3 py-1.5 text-[12px] font-medium text-[#f87171]"
                  @click="stopRecording"
                >
                  ■ 停止并归档
                </button>
              </div>
              <div class="mt-1.5 text-[11px] text-[rgba(245,249,254,0.4)]">
                正在录制屏幕（含系统声音）· 停止后自动下载视频并记录到本档案
              </div>
            </div>

            <div v-if="recordError" class="mt-2 text-[12px] text-[#f87171]">{{ recordError }}</div>
            <div v-if="recordNote" class="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[#60f2bd]">
              ✓ {{ recordNote }}
              <RouterLink to="/interview/review" class="rounded border border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.08)] px-2 py-0.5 text-[11.5px] font-medium text-[#32f08c] no-underline hover:bg-[rgba(50,240,140,0.15)]">
                去 AI 复盘 →
              </RouterLink>
            </div>
            <div v-if="saveError" class="mt-2 text-[12px] text-[#f87171]">{{ saveError }}</div>

            <!-- 归档列表 -->
            <div v-if="archives.length" class="mt-4 space-y-2">
              <div class="text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
                归档（{{ archives.length }}）
              </div>
              <div
                v-for="a in archives"
                :key="a.id"
                class="flex items-center justify-between gap-2 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="truncate text-[12.5px] text-[rgba(245,249,254,0.75)]">
                    {{ a.kind === 'recording' ? '🎬' : '📎' }} {{ a.title }}
                  </div>
                  <div class="mt-0.5 flex flex-wrap gap-x-3 text-[10.5px] text-[rgba(245,249,254,0.35)]">
                    <span v-if="a.file_name" class="truncate">{{ a.file_name }}</span>
                    <span v-if="a.duration">{{ fmtDuration(a.duration) }}</span>
                    <span v-if="a.file_size">{{ fmtSize(a.file_size) }}</span>
                    <span>{{ a.occurred_at }}</span>
                  </div>
                </div>
                <button class="shrink-0 text-[11px] text-[rgba(245,249,254,0.35)] hover:text-[#f87171]" @click="removeArchive(a.id)">
                  删除
                </button>
              </div>
            </div>
            <div v-else class="mt-4 py-2 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
              面试前选好软件 → 开始录屏；录完自动归档到这里（视频文件保存在本地）
            </div>
          </div>
        </section>
      </div>

      <div v-else class="card-glass mt-10 flex flex-col items-center gap-3 px-5 py-14 text-center">
        <span class="text-3xl">🗂️</span>
        <div class="text-[14px] text-[rgba(245,249,254,0.6)]">投递不存在或已删除</div>
        <SecondaryButton @click="router.push('/tracking')">返回看板</SecondaryButton>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <ApplicationEditModal v-if="app && editing" :app="app" @close="editing = false" @save="onSaveEdit" />

    <!-- 面试软件管理 -->
    <Modal v-if="showToolManager" title="管理面试软件" max-width="max-w-md" @close="showToolManager = false">
      <div class="space-y-4">
        <div class="flex gap-2">
          <input
            v-model="newToolName"
            class="input-trae h-9 flex-1 text-[12.5px]"
            placeholder="如：腾讯会议 / 飞书 / 线下…"
          />
          <select v-model="newToolKind" class="input-trae h-9 w-auto appearance-none text-[12.5px]">
            <option value="video">线上会议</option>
            <option value="onsite">线下</option>
            <option value="phone">电话</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div class="flex gap-2">
          <input
            v-model="newToolUrl"
            class="input-trae h-9 flex-1 text-[12.5px]"
            placeholder="打开链接（可选，如会议入口 URL）"
          />
          <button
            class="rounded-lg border border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.08)] px-4 py-1.5 text-[12.5px] font-medium text-[#32f08c]"
            :disabled="!newToolName.trim()"
            @click="addTool"
          >
            添加
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="t in toolsStore.tools"
            :key="t.id"
            class="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2"
          >
            <div class="min-w-0">
              <span class="text-[13px] font-medium text-[#f5f9fe]">{{ t.name }}</span>
              <span class="ml-2 text-[10.5px] text-[rgba(245,249,254,0.35)]">{{ toolsStore.TOOL_KIND_LABEL[t.kind] }}</span>
            </div>
            <button class="shrink-0 text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]" @click="toolsStore.removeTool(t.id)">
              删除
            </button>
          </div>
          <div v-if="!toolsStore.tools.length" class="py-3 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
            还没有面试软件，上方添加
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
