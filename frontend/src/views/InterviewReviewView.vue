<script setup lang="ts">
/**
 * 面试复盘（C3）：选择投递 → 基于其全部面试记录生成复盘要点。
 * - 当前为本地启发式生成（无 AI 后端兜底），接入后端后替换为真实模型
 * - 同投递复盘自动覆盖（避免无限累积）；全局可检索沉淀的面经
 */
import { APPLICATION_STATUS_META } from '@pa/shared'
import { buildLocalReflection } from '@pa/shared/interview'
import { computed, ref } from 'vue'

import ApplicationPicker from '@/components/application/ApplicationPicker.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useInterviewStore } from '@/stores/interview'

const appStore = useApplicationStore()
const interviewStore = useInterviewStore()

const selectedId = ref<string | null>(null)

const candidates = computed(() =>
  [...appStore.applications].sort((a, b) => {
    const hasA = interviewStore.interviewsOf(a.id).length > 0
    const hasB = interviewStore.interviewsOf(b.id).length > 0
    return (hasB ? 1 : 0) - (hasA ? 1 : 0) || (a.updated_at < b.updated_at ? 1 : -1)
  }),
)

const selected = computed(() =>
  selectedId.value ? appStore.applications.find((a) => a.id === selectedId.value) ?? null : null,
)
const interviews = computed(() =>
  selectedId.value ? interviewStore.interviewsOf(selectedId.value) : [],
)

/** 复盘草稿（生成后可编辑再保存） */
const draft = ref<{
  highlights: string[]
  improvements: string[]
  next_strategy: string[]
  content_md: string
} | null>(null)

const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined
function notify(msg: string): void {
  flash.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = ''), 3200)
}

/** 该投递已保存的复盘（最新一条） */
const savedReflections = computed(() =>
  selectedId.value
    ? interviewStore.reflections
        .filter((r) => r.application_id === selectedId.value)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    : [],
)

function selectApp(id: string): void {
  selectedId.value = id
  draft.value = null
}

function reflectionCount(appId: string): number {
  return interviewStore.reflections.filter((r) => r.application_id === appId).length
}

/** 生成时覆盖的面试 id 快照（保存时用同一集合，避免期间新增轮次被误计入） */
const draftInterviewIds = ref<string[]>([])

function generate(): void {
  if (!selected.value || !interviews.value.length) return
  draftInterviewIds.value = interviews.value.map((i) => i.id)
  draft.value = buildLocalReflection(interviews.value, {
    company: selected.value.company,
    title: selected.value.title,
  })
}

function addLine(list: 'highlights' | 'improvements' | 'next_strategy'): void {
  if (!draft.value) return
  draft.value[list].push('')
}

function removeLine(list: 'highlights' | 'improvements' | 'next_strategy', i: number): void {
  if (!draft.value) return
  draft.value[list].splice(i, 1)
}

/** 保存复盘：同投递自动覆盖（store 内 upsert 去重）；空内容拒绝保存 */
function save(): void {
  if (!draft.value || !selectedId.value) return
  const highlights = draft.value.highlights.filter((s) => s.trim())
  const improvements = draft.value.improvements.filter((s) => s.trim())
  const next_strategy = draft.value.next_strategy.filter((s) => s.trim())
  if (!highlights.length && !improvements.length && !next_strategy.length && !draft.value.content_md.trim()) {
    notify('复盘内容为空，未保存')
    return
  }
  interviewStore.upsertReflection({
    application_id: selectedId.value,
    interview_ids: draftInterviewIds.value, // 生成时快照，而非保存时的面试集
    highlights,
    improvements,
    next_strategy,
    content_md: draft.value.content_md,
    ai_generated: true,
  })
  notify('复盘已保存（覆盖该投递上一版）')
  draft.value = null
  draftInterviewIds.value = []
}

function removeReflection(id: string): void {
  interviewStore.removeReflection(id)
  notify('已删除复盘')
}

/* ── C3 可检索面经：全局搜索全部复盘 ── */
const search = ref('')
const allReflections = computed(() =>
  [...interviewStore.reflections].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
)
const searchable = computed(() => {
  const kw = search.value.trim().toLowerCase()
  if (!kw) return []
  return allReflections.value.filter((r) => {
    const app = appStore.applications.find((a) => a.id === r.application_id)
    const hay = [
      app?.company ?? '',
      app?.title ?? '',
      r.content_md,
      ...r.highlights,
      ...r.improvements,
      ...r.next_strategy,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(kw)
  })
})
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-16">
      <PageHeader code="C3" title="面试复盘" desc="基于一轮或多轮记录生成要点 · 沉淀为可检索面经" />

      <!-- 提示条（读屏播报） -->
      <div
        v-if="flash"
        role="status"
        aria-live="polite"
        class="card-glass fixed left-1/2 top-20 z-50 -translate-x-1/2 px-5 py-3 text-[13px] text-[#60f2bd]"
      >
        {{ flash }}
      </div>

      <!-- 全局检索 -->
      <section class="card-glass mb-6 p-4" style="backdrop-filter: blur(28px) saturate(1.6)">
        <input v-model="search" class="input-trae" placeholder="🔍 检索全部沉淀面经（公司 / 岗位 / 关键词）…" />
        <div v-if="search.trim()" class="mt-2 text-[11.5px] text-[rgba(245,249,254,0.4)]">
          命中 {{ searchable.length }} 条复盘
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <!-- 左：投递列表 -->
        <ApplicationPicker
          :candidates="candidates"
          :selected-id="selectedId"
          :meta-for="(app) => `面试 ${interviewStore.interviewsOf(app.id).length} 轮 · 复盘 ${reflectionCount(app.id)} 条`"
          empty-hint="暂无投递"
          @select="selectApp"
        />

        <!-- 右 -->
        <section class="min-w-0">
          <div
            v-if="!selected"
            class="card-glass flex h-[300px] flex-col items-center justify-center gap-3 text-center"
          >
            <span class="text-3xl">📝</span>
            <div class="text-[14px] text-[rgba(245,249,254,0.6)]">选择一个投递，基于其面试记录生成复盘</div>
          </div>

          <div v-else class="space-y-4">
            <!-- 投递摘要 + 生成按钮 -->
            <div class="card-glass flex flex-wrap items-center justify-between gap-3 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
              <div>
                <div class="heading-tight text-[17px] text-[#f5f9fe]">{{ selected.title }}</div>
                <div class="mt-0.5 text-[12.5px] text-[rgba(245,249,254,0.5)]">
                  {{ selected.company }} · {{ interviews.length }} 轮面试
                </div>
              </div>
              <PrimaryButton :disabled="!interviews.length" @click="generate">
                生成复盘要点
              </PrimaryButton>
            </div>

            <!-- 复盘草稿编辑器 -->
            <div v-if="draft" class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
              <div class="mb-4 flex items-center justify-between">
                <span class="text-[13px] font-semibold text-[#f5f9fe]">
                  复盘要点（本地启发式 · 可编辑）
                </span>
                <span class="text-[11px] text-[rgba(245,249,254,0.35)]">
                  接入 AI 后自动升级为模型生成
                </span>
              </div>

              <div class="space-y-4">
                <!-- 做得好 -->
                <div class="rounded-lg border border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.04)] p-3.5">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold text-[#60f2bd]">✅ 做得好</span>
                    <button class="text-[11px] text-[rgba(245,249,254,0.4)] hover:text-[#32f08c]" @click="addLine('highlights')">
                      ＋ 新增
                    </button>
                  </div>
                  <div v-for="(line, i) in draft.highlights" :key="i" class="flex items-center gap-2">
                    <input v-model="draft.highlights[i]" class="input-trae h-9 text-[12.5px]" />
                    <button class="text-[11px] text-[rgba(245,249,254,0.3)] hover:text-[#f87171]" @click="removeLine('highlights', i)">✕</button>
                  </div>
                </div>

                <!-- 待改进 -->
                <div class="rounded-lg border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.04)] p-3.5">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold text-[#f87171]">⚠️ 待改进</span>
                    <button class="text-[11px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]" @click="addLine('improvements')">
                      ＋ 新增
                    </button>
                  </div>
                  <div v-for="(line, i) in draft.improvements" :key="i" class="flex items-center gap-2">
                    <input v-model="draft.improvements[i]" class="input-trae h-9 text-[12.5px]" />
                    <button class="text-[11px] text-[rgba(245,249,254,0.3)] hover:text-[#f87171]" @click="removeLine('improvements', i)">✕</button>
                  </div>
                </div>

                <!-- 下次策略 -->
                <div class="rounded-lg border border-[rgba(56,189,248,0.2)] bg-[rgba(56,189,248,0.04)] p-3.5">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold text-[#38bdf8]">🎯 下次策略</span>
                    <button class="text-[11px] text-[rgba(245,249,254,0.4)] hover:text-[#38bdf8]" @click="addLine('next_strategy')">
                      ＋ 新增
                    </button>
                  </div>
                  <div v-for="(line, i) in draft.next_strategy" :key="i" class="flex items-center gap-2">
                    <input v-model="draft.next_strategy[i]" class="input-trae h-9 text-[12.5px]" />
                    <button class="text-[11px] text-[rgba(245,249,254,0.3)] hover:text-[#f87171]" @click="removeLine('next_strategy', i)">✕</button>
                  </div>
                </div>
              </div>

              <div class="mt-5 flex items-center justify-end gap-3">
                <SecondaryButton @click="draft = null">放弃</SecondaryButton>
                <PrimaryButton @click="save">保存复盘</PrimaryButton>
              </div>
            </div>

            <!-- 已保存复盘 -->
            <div v-if="savedReflections.length" class="space-y-3">
              <div class="text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
                已保存复盘（{{ savedReflections.length }} 条 · 同投递保存自动覆盖上一版）
              </div>
              <div v-for="ref in savedReflections" :key="ref.id" class="card-glass p-5">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                    {{ new Date(ref.created_at).toLocaleDateString('zh-CN') }} · 生成
                  </span>
                  <button class="text-[11px] text-[rgba(245,249,254,0.35)] hover:text-[#f87171]" @click="removeReflection(ref.id)">
                    删除
                  </button>
                </div>
                <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div class="mb-1.5 text-[11px] font-semibold text-[#60f2bd]">做得好</div>
                    <ul class="space-y-1 text-[12.5px] text-[rgba(245,249,254,0.65)]">
                      <li v-for="h in ref.highlights" :key="h">· {{ h }}</li>
                    </ul>
                  </div>
                  <div>
                    <div class="mb-1.5 text-[11px] font-semibold text-[#f87171]">待改进</div>
                    <ul class="space-y-1 text-[12.5px] text-[rgba(245,249,254,0.65)]">
                      <li v-for="i in ref.improvements" :key="i">· {{ i }}</li>
                    </ul>
                  </div>
                  <div>
                    <div class="mb-1.5 text-[11px] font-semibold text-[#38bdf8]">下次策略</div>
                    <ul class="space-y-1 text-[12.5px] text-[rgba(245,249,254,0.65)]">
                      <li v-for="s in ref.next_strategy" :key="s">· {{ s }}</li>
                    </ul>
                  </div>
                </div>
                <pre class="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(237,239,242,0.03)] p-3 text-[12px] leading-relaxed text-[rgba(245,249,254,0.5)]">{{ ref.content_md }}</pre>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 检索结果（全局面经） -->
      <section v-if="searchable.length" class="mt-8">
        <div class="mb-3 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
          检索结果
        </div>
        <div v-for="ref in searchable" :key="ref.id" class="card-glass mb-3 p-4">
          <div class="text-[12px] font-medium text-[#60f2bd]">
            {{ appStore.applications.find((a) => a.id === ref.application_id)?.company ?? '未知公司' }} · {{ appStore.applications.find((a) => a.id === ref.application_id)?.title ?? '' }}
          </div>
          <ul class="mt-2 space-y-1 text-[12.5px] text-[rgba(245,249,254,0.65)]">
            <li v-for="h in ref.improvements.slice(0, 3)" :key="h">· {{ h }}</li>
            <li v-for="s in ref.next_strategy.slice(0, 3)" :key="s">· {{ s }}</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>
