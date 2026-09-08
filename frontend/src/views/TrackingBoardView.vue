<script setup lang="ts">
/**
 * 投递看板（B1）：按状态机的多列看板 / 列表视图。
 * - 筛选：关键词 / 渠道 / 标签分类；排序：更新时间 / 投递时间 / 重要性 / 标题
 * - 「呈现设置」选择视图、默认排序、卡片显示字段（需求：呈现方式可配置）
 * - 点卡片进入投递详情档案（连接面试 / 复盘 / 归档）
 * - 操作：推进、标记终态（Offer/拒绝/放弃）、编辑、删除
 */
import type { Application, ApplicationPayload, ApplicationStatus } from '@pa/shared'
import { groupByStatus, nextStage, statusMeta } from '@pa/shared/application'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ApplicationEditModal from '@/components/application/ApplicationEditModal.vue'
import BridgeSyncPanel from '@/components/BridgeSyncPanel.vue'
import Modal from '@/components/Modal.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import { generateResume } from '@/lib/aiClient'
import { transitionTargets, useApplicationStore } from '@/stores/application'
import { useArchivesStore } from '@/stores/archives'
import { FIELD_LABELS, useBoardPrefsStore } from '@/stores/boardPrefs'
import { useInterviewStore } from '@/stores/interview'
import { useProfileStore } from '@/stores/profile'
import { useQuestionBankStore } from '@/stores/questionBank'
import { useResumeTreeStore } from '@/stores/resumeTree'

const store = useApplicationStore()
const prefsStore = useBoardPrefsStore()
const prefs = prefsStore.prefs
const router = useRouter()
const profileStore = useProfileStore()
const resumeTree = useResumeTreeStore()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'board', label: '看板', path: '/tracking' },
  { id: 'collect', label: '岗位采集', path: '/tracking/collect' },
  { id: 'import', label: '批量导入', path: '/tracking/import' },
  { id: 'interview', label: '面试复盘', path: '/interview' },
  { id: 'stats', label: '投递统计', path: '/tracking/stats' },
  { id: 'resume', label: '特化简历', path: '/tracking/resume' },
]

/* ── 筛选状态 ── */
const search = ref('')
const filterChannel = ref<string | null>(null)
const filterTags = ref<Set<string>>(new Set())
const showSettings = ref(false)

const allChannels = computed(() => {
  const set = new Set<string>()
  for (const a of store.applications) if (a.channel) set.add(a.channel)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const allTags = computed(() => {
  const set = new Set<string>()
  for (const a of store.applications) for (const t of a.tags) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 全部分组维度（去重排序，供筛选） */
const allGroups = computed(() => {
  const set = new Set<string>()
  for (const a of store.applications) for (const g of a.groups ?? []) if (g) set.add(g)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 分组筛选（多选；空集合 = 不限） */
const filterGroups = ref<Set<string>>(new Set())

function toggleGroup(g: string): void {
  if (filterGroups.value.has(g)) filterGroups.value.delete(g)
  else filterGroups.value.add(g)
}

const filteredApps = computed(() =>
  store.applications.filter((a) => {
    if (search.value.trim()) {
      const kw = search.value.trim().toLowerCase()
      const hay = `${a.company} ${a.title} ${a.notes} ${a.jd ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    if (filterChannel.value && a.channel !== filterChannel.value) return false
    if (filterTags.value.size && !a.tags.some((t) => filterTags.value.has(t))) return false
    if (filterGroups.value.size && !(a.groups ?? []).some((g) => filterGroups.value.has(g))) return false
    return true
  }),
)

const board = computed(() => groupByStatus(filteredApps.value))

/* ── 排序 ── */
const SORT_OPTIONS = [
  { key: 'updated', label: '更新时间' },
  { key: 'applied', label: '投递时间' },
  { key: 'importance', label: '重要性' },
  { key: 'title', label: '标题' },
] as const
type SortKey = (typeof SORT_OPTIONS)[number]['key']

function sortCompare(a: Application, b: Application, key: SortKey): number {
  switch (key) {
    case 'importance':
      return (a.importance ?? 5) - (b.importance ?? 5) // 1 最高
    case 'applied':
      return (a.applied_at ?? '') === (b.applied_at ?? '')
        ? 0
        : (a.applied_at ?? '') < (b.applied_at ?? '')
          ? 1
          : -1
    case 'title':
      return a.title.localeCompare(b.title, 'zh-CN')
    default:
      return a.updated_at === b.updated_at ? 0 : a.updated_at < b.updated_at ? 1 : -1
  }
}

const sortedApps = computed(() =>
  [...filteredApps.value].sort((a, b) => sortCompare(a, b, prefs.sortMode)),
)

/** 视图切换（三态分段） */
const VIEW_OPTIONS = [
  { k: 'board', l: '看板' },
  { k: 'list', l: '列表' },
  { k: 'pipeline', l: '全流程' },
] as const

function toggleTag(t: string): void {
  if (filterTags.value.has(t)) filterTags.value.delete(t)
  else filterTags.value.add(t)
}

function clearFilters(): void {
  search.value = ''
  filterChannel.value = null
  filterTags.value = new Set()
  filterGroups.value = new Set()
}

function countOf(status: ApplicationStatus): number {
  return (board.value[status] ?? []).length
}

/** 某投递的事件（按时间正序） */
function eventsOf(appId: string): Array<{ from: ApplicationStatus | null; to: ApplicationStatus; at: string }> {
  return store.events
    .filter((e) => e.application_id === appId)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
}

/** 全流程泳道阶段节点：前置 + 该投递的轮次（到达/当前状态） */
function pipelineStages(
  app: Application,
): Array<{
  status: ApplicationStatus
  label: string
  reached: boolean
  current: boolean
  dot: string
  text: string
}> {
  const total = app.total_rounds ?? 3
  const stages: ApplicationStatus[] = ['backlog', 'applied', 'viewed']
  for (let i = 1; i <= total; i++) stages.push(`round_${i}`)
  const reachedSet = new Set(eventsOf(app.id).map((e) => e.to))
  return stages.map((s) => {
    const meta = statusMeta(s, total)
    return {
      status: s,
      label: meta.label,
      reached: reachedSet.has(s) || app.status === s,
      current: app.status === s,
      dot: meta.dot,
      text: meta.text,
    }
  })
}

function openDetail(id: string): void {
  router.push(`/tracking/detail/${id}`)
}

/** 当前打开的「标记」菜单 id 与其按钮位置 */
const openMenuId = ref<string | null>(null)
const menuPos = ref<{ top: number; left: number }>({ top: 0, left: 0 })
const menuApp = computed<Application | null>(() => {
  if (!openMenuId.value) return null
  return store.applications.find((a) => a.id === openMenuId.value) ?? null
})

const menuTargets = computed(() => {
  const app = menuApp.value
  if (!app) return []
  return transitionTargets(app.status, app.total_rounds ?? 3).filter((s) => s !== app.status)
})

/** 正在编辑的投递（null = 不显示弹窗） */
const editing = ref<Application | null>(null)

function canAdvance(app: Application): boolean {
  return nextStage(app.status, app.total_rounds ?? 3) !== null
}

function closeMenu(): void {
  openMenuId.value = null
}

function toggleMenu(app: Application, event: MouseEvent): void {
  if (openMenuId.value === app.id) {
    closeMenu()
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  menuPos.value = { top: rect.bottom + 6, left: Math.max(8, rect.right - 150) }
  openMenuId.value = app.id
}

/** 状态操作统一 catch：localStorage 失败时提示（内存已变但未持久化，刷新回退） */
function safeStatusAction(action: () => boolean): void {
  try {
    action()
  } catch {
    window.alert('保存失败：本地存储不可用或已满')
  }
  closeMenu()
}

function onAdvance(app: Application): void {
  safeStatusAction(() => store.advance(app.id))
}

/* ── AI 特化简历（backlog 阶段，投递前） ── */
const specializing = ref<string | null>(null)
const specializeMsg = ref('')

async function specializeResume(app: Application): Promise<void> {
  if (specializing.value) return
  const jd = app.jd?.trim()
  if (!jd) {
    specializeMsg.value = '该投递没有 JD，请先在详情页补充岗位描述'
    window.setTimeout(() => (specializeMsg.value = ''), 3200)
    return
  }
  // 去重：同一投递只生成一份特化简历（避免重复节点）
  if (resumeTree.getByApplication(app.id)) {
    specializeMsg.value = '该投递已有特化简历，可到「简历」页查看或删除后重新生成'
    window.setTimeout(() => (specializeMsg.value = ''), 3200)
    return
  }
  specializing.value = app.id
  specializeMsg.value = ''
  try {
    const profileText = JSON.stringify(profileStore.profile, null, 2)
    const md = await generateResume(jd, profileText)
    resumeTree.addNode({
      title: `特化-${app.company || '未知公司'}-${app.title || '岗位'}`,
      parent_id: resumeTree.baseResume?.id ?? null,
      kind: 'specialized',
      application_id: app.id,
      content_md: md,
      jd: jd.slice(0, 200),
    })
    specializeMsg.value = `已生成特化简历「${app.title || '岗位'}」，可在「简历」页查看`
    window.setTimeout(() => (specializeMsg.value = ''), 4000)
  } catch (e) {
    specializeMsg.value = e instanceof Error ? e.message : 'AI 特化失败'
    window.setTimeout(() => (specializeMsg.value = ''), 4000)
  } finally {
    specializing.value = null
  }
}

function onTerminal(app: Application, to: ApplicationStatus): void {
  let reason: string | undefined
  if (to === 'rejected') {
    const input = window.prompt(`标记「${app.company} · ${app.title}」为拒绝。失败原因？`, app.reject_reason ?? '')
    if (input === null) return
    reason = input
  }
  safeStatusAction(() => store.transition(app.id, to, undefined, reason))
}

function onRemove(app: Application): void {
  if (!window.confirm(`删除「${app.company} · ${app.title}」及其全部事件？`)) return
  const interviewStore = useInterviewStore()
  const questionBank = useQuestionBankStore()
  const archives = useArchivesStore()
  for (const interview of interviewStore.interviewsOf(app.id)) {
    questionBank.removeByInterviewId(interview.id)
  }
  interviewStore.removeByApplication(app.id)
  archives.removeByApplication(app.id) // 清理孤儿归档（录制/附件）
  store.removeApplication(app.id)
  closeMenu()
}

function onSaveEdit(payload: ApplicationPayload): void {
  if (editing.value) {
    store.updateApplication(editing.value.id, {
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
  }
  editing.value = null
}

/* ── 菜单关闭治理 ── */
function onGlobalPointerDown(e: PointerEvent): void {
  if (!openMenuId.value) return
  const target = e.target as HTMLElement
  if (target.closest('[data-menu-root]') || target.closest('[data-menu-trigger]')) return
  closeMenu()
}
function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeMenu()
}
onMounted(() => {
  document.addEventListener('pointerdown', onGlobalPointerDown)
  document.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onGlobalPointerDown)
  document.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-8">
      <!-- 头部 -->
      <PageHeader code="B1" title="投递看板" :desc="`状态自动流转 · 共 ${store.total} 条投递`">
        <RouterLink to="/tracking/collect" class="btn-primary-trae">＋ 新建投递</RouterLink>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- AI 特化简历提示 -->
      <div
        v-if="specializeMsg"
        class="card-glass mb-4 flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] text-neutral-500"
      >
        <span>{{ specializeMsg }}</span>
        <button class="shrink-0 text-neutral-400 hover:text-neutral-900" @click="specializeMsg = ''">✕</button>
      </div>

      <!-- 同步采集数据（插件采集 → 看板） -->
      <section class="card-glass mb-5 p-3">
        <BridgeSyncPanel />
      </section>

      <!-- 筛选栏 -->
      <section class="card-glass mb-5 space-y-2.5 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="search"
            class="input-trae h-9 flex-1 min-w-[160px] text-[12.5px]"
            placeholder="🔍 搜索公司 / 岗位 / 备注 / JD…"
          />
          <select v-model="filterChannel" class="input-trae h-9 w-auto appearance-none text-[12.5px]">
            <option :value="null">全部渠道</option>
            <option v-for="c in allChannels" :key="c" :value="c">{{ c }}</option>
          </select>
          <div class="flex shrink-0 overflow-hidden rounded-lg border border-neutral-300">
            <button
              v-for="m in VIEW_OPTIONS"
              :key="m.k"
              class="px-2.5 py-1.5 text-[11.5px] transition-colors"
              :class="
                prefs.viewMode === m.k
                  ? 'bg-neutral-200 text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              "
              @click="prefsStore.set({ viewMode: m.k })"
            >
              {{ m.l }}
            </button>
          </div>
          <button
            class="rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-[12px] font-medium text-neutral-900"
            @click="showSettings = true"
          >
            ⚙ 呈现设置
          </button>
          <button
            v-if="search || filterChannel || filterTags.size || filterGroups.size"
            class="rounded-lg px-2 py-1.5 text-[12px] text-neutral-400 hover:text-red-600"
            @click="clearFilters"
          >
            清除筛选
          </button>
        </div>

        <!-- 标签分类 -->
        <div v-if="allTags.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-neutral-400">标签：</span>
          <button
            v-for="t in allTags"
            :key="t"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="
              filterTags.has(t)
                ? 'border-neutral-900 bg-neutral-100 text-neutral-900'
                : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:text-neutral-900'
            "
            @click="toggleTag(t)"
          >
            #{{ t }}
          </button>
        </div>

        <!-- 分组筛选 -->
        <div v-if="allGroups.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-neutral-400">分组：</span>
          <button
            v-for="g in allGroups"
            :key="g"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="
              filterGroups.has(g)
                ? 'border-neutral-900 bg-neutral-100 text-neutral-900'
                : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:text-neutral-900'
            "
            @click="toggleGroup(g)"
          >
            ◆ {{ g }}
          </button>
        </div>

        <!-- 排序 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] text-neutral-400">排序：</span>
          <button
            v-for="opt in SORT_OPTIONS"
            :key="opt.key"
            class="rounded-full px-2.5 py-0.5 text-[11.5px] transition-colors"
            :class="
              prefs.sortMode === opt.key
                ? 'bg-neutral-200 text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900'
            "
            @click="prefsStore.set({ sortMode: opt.key })"
          >
            {{ opt.label }}
          </button>
          <span class="ml-auto font-mono text-[11px] text-neutral-400">
            {{ filteredApps.length }} / {{ store.total }} 条
          </span>
        </div>
      </section>

      <!-- ═══════ 看板视图 ═══════ -->
      <section v-if="prefs.viewMode === 'board'" class="min-h-0 flex-1 overflow-x-auto">
        <div class="flex h-full gap-4 pb-2" style="min-width: max-content">
          <div
            v-for="status in store.boardStatuses"
            :key="status"
            class="flex w-[252px] shrink-0 flex-col rounded-xl border border-neutral-200 bg-neutral-50"
          >
            <div class="flex items-center gap-2 px-3 py-3">
              <span class="h-2 w-2 rounded-full" :class="statusMeta(status).dot" />
              <span class="text-[13px] font-semibold text-neutral-900">{{ statusMeta(status).label }}</span>
              <span class="font-mono text-[11px] text-neutral-400">{{ countOf(status) }}</span>
              <span v-if="statusMeta(status).terminal" class="ml-auto text-[10px] text-neutral-400">终态</span>
            </div>

            <div class="flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-2.5">
              <div
                v-for="app in (board[status] ?? []).slice().sort((a, b) => sortCompare(a, b, prefs.sortMode))"
                :key="app.id"
                class="card-glass group cursor-pointer p-3.5"
                @click="openDetail(app.id)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-[14px] font-semibold text-neutral-900">
                      {{ app.title || '未命名岗位' }}
                    </div>
                    <div class="mt-0.5 truncate text-[12px] text-neutral-500">
                      {{ app.company }}
                    </div>
                  </div>
                  <span
                    class="shrink-0 rounded-full border px-2 py-0.5 text-[10.5px]"
                    :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
                  >
                    {{ statusMeta(app.status, app.total_rounds).label }}
                  </span>
                </div>

                <!-- 卡片字段（按设置显示） -->
                <div v-if="prefs.showFields.importance && app.importance" class="mt-1.5 text-[11px] text-neutral-600">
                  {{ '★'.repeat(app.importance) }}<span class="text-neutral-400">{{ '☆'.repeat(5 - app.importance) }}</span>
                </div>
                <div v-if="(prefs.showFields.channel && app.channel) || (prefs.showFields.date && app.applied_at)" class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span v-if="prefs.showFields.channel && app.channel" class="text-[11px] text-neutral-400">📌 {{ app.channel }}</span>
                  <span v-if="prefs.showFields.date && app.applied_at" class="font-mono text-[11px] text-neutral-400">{{ app.applied_at }}</span>
                </div>
                <div v-if="prefs.showFields.tags && app.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="t in app.tags"
                    :key="t"
                    class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] text-neutral-600"
                  >
                    #{{ t }}
                  </span>
                </div>
                <p v-if="prefs.showFields.notes && app.notes" class="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-neutral-500">
                  {{ app.notes }}
                </p>

                <!-- 操作 -->
                <div class="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2.5" @click.stop>
                  <button
                    v-if="canAdvance(app)"
                    class="text-[12px] font-medium text-neutral-900 transition-colors hover:underline"
                    @click="onAdvance(app)"
                  >
                    推进 ▸
                  </button>
                  <span v-else class="text-[12px] text-neutral-300">
                    {{ statusMeta(app.status, app.total_rounds).terminal ? '已结束' : '最后一轮 · 待定' }}
                  </span>

                  <div class="relative flex items-center gap-2">
                    <button
                      v-if="resumeTree.getByApplication(app.id)"
                      class="rounded px-1.5 py-0.5 text-[11px] text-neutral-600 transition-colors hover:underline"
                      title="已关联简历，点击查看"
                      @click="router.push('/resume')"
                    >
                      简历 ✓
                    </button>
                    <button
                      v-if="app.status === 'backlog'"
                      class="rounded px-1.5 py-0.5 text-[11px] text-neutral-700 transition-colors hover:underline"
                      :disabled="specializing !== null"
                      @click="specializeResume(app)"
                    >
                      {{ specializing === app.id ? '特化中…' : '✨ AI 特化' }}
                    </button>
                    <button
                      class="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
                      @click="editing = app"
                    >
                      编辑
                    </button>
                    <button
                      class="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 transition-colors hover:text-red-600"
                      @click="onRemove(app)"
                    >
                      删除
                    </button>
                    <button
                      v-if="!statusMeta(app.status, app.total_rounds).terminal"
                      data-menu-trigger
                      aria-haspopup="menu"
                      :aria-expanded="openMenuId === app.id"
                      class="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                      @click="toggleMenu(app, $event)"
                    >
                      标记 ▾
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!(board[status] ?? []).length" class="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-[11.5px] text-neutral-300">
                暂无投递
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════ 列表视图 ═══════ -->
      <section v-else-if="prefs.viewMode === 'list'" class="card-glass overflow-x-auto p-2">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-neutral-200 text-[11px] text-neutral-400">
              <th class="py-2.5 pl-3 pr-3 font-medium">状态</th>
              <th class="py-2.5 pr-3 font-medium">公司 / 岗位</th>
              <th class="py-2.5 pr-3 font-medium">渠道</th>
              <th class="py-2.5 pr-3 font-medium">投递日期</th>
              <th class="py-2.5 pr-3 font-medium">重要性</th>
              <th class="py-2.5 pr-3 font-medium">标签</th>
              <th class="py-2.5 pr-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="app in sortedApps"
              :key="app.id"
              class="cursor-pointer border-b border-neutral-200 transition-colors last:border-0 hover:bg-neutral-50"
              @click="openDetail(app.id)"
            >
              <td class="py-2.5 pl-3 pr-3">
                <span
                  class="rounded-full border px-2 py-0.5 text-[10.5px]"
                  :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
                >
                  {{ statusMeta(app.status, app.total_rounds).label }}
                </span>
              </td>
              <td class="py-2.5 pr-3">
                <div class="text-[12.5px] font-medium text-neutral-900">{{ app.title }}</div>
                <div class="text-[11px] text-neutral-400">{{ app.company }}</div>
              </td>
              <td class="py-2.5 pr-3 text-[12px] text-neutral-500">{{ app.channel || '—' }}</td>
              <td class="py-2.5 pr-3 font-mono text-[11.5px] text-neutral-500">{{ app.applied_at || '—' }}</td>
              <td class="py-2.5 pr-3 text-[11.5px] text-neutral-600">
                {{ app.importance ? '★'.repeat(app.importance) : '—' }}
              </td>
              <td class="py-2.5 pr-3">
                <div class="flex flex-wrap gap-1">
                  <span v-for="t in app.tags" :key="t" class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600">#{{ t }}</span>
                </div>
              </td>
              <td class="py-2.5 pr-3 font-mono text-[11px] text-neutral-400">
                {{ app.updated_at.slice(0, 10) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!sortedApps.length" class="py-10 text-center text-[12px] text-neutral-400">
          没有匹配的投递
        </div>
      </section>

      <!-- ═══════ 全流程视图（以公司/岗位为单位） ═══════ -->
      <section v-else class="space-y-3">
        <div class="text-[11.5px] text-neutral-400">
          每个投递一行，展示从备选到当前阶段的完整流程（点击进入详情档案）
        </div>
        <div
          v-for="app in sortedApps"
          :key="app.id"
          class="card-glass cursor-pointer p-4 transition-colors hover:border-neutral-300"
          @click="openDetail(app.id)"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-[14px] font-semibold text-neutral-900">{{ app.title }}</div>
              <div class="mt-0.5 truncate text-[12px] text-neutral-500">
                {{ app.company }}<span v-if="app.channel"> · {{ app.channel }}</span>
              </div>
            </div>
            <span
              class="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px]"
              :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
            >
              {{ statusMeta(app.status, app.total_rounds).label }}
            </span>
          </div>

          <!-- 流程泳道 -->
          <div class="mt-3 flex items-center overflow-x-auto pb-1">
            <template v-for="(node, i) in pipelineStages(app)" :key="node.status">
              <div class="flex shrink-0 flex-col items-center gap-1">
                <span
                  class="h-3 w-3 rounded-full border-2"
                  :class="
                    node.current
                      ? 'border-neutral-900 bg-neutral-900'
                      : node.reached
                        ? node.dot
                        : 'border-neutral-400 bg-transparent'
                  "
                />
                <span
                  class="whitespace-nowrap px-0.5 text-[10px]"
                  :class="node.current ? 'font-medium text-neutral-900' : node.reached ? node.text : 'text-neutral-300'"
                >
                  {{ node.label }}
                </span>
              </div>
              <div
                v-if="i < pipelineStages(app).length - 1"
                class="h-0.5 min-w-3 flex-1 rounded"
                :class="pipelineStages(app)[i]?.reached ? 'bg-neutral-500' : 'bg-neutral-200'"
              />
            </template>
          </div>

          <!-- 事件简史 -->
          <div v-if="eventsOf(app.id).length" class="mt-2 truncate text-[10.5px] text-neutral-400">
            {{ eventsOf(app.id).slice(-3).map((e) => `${statusMeta(e.from ?? e.to).label} → ${statusMeta(e.to).label}`).join(' · ') }}
          </div>
        </div>

        <div v-if="!sortedApps.length" class="card-glass py-10 text-center text-[12px] text-neutral-400">
          没有匹配的投递
        </div>
      </section>
    </div>

    <!-- 编辑弹窗 -->
    <ApplicationEditModal v-if="editing" :app="editing" @close="editing = null" @save="onSaveEdit" />

    <!-- 「标记」菜单 -->
    <Teleport to="body">
      <div
        v-if="menuApp"
        data-menu-root
        role="menu"
        class="fixed z-50 w-[150px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-lg"
        :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
      >
        <button
          v-for="target in menuTargets"
          :key="target"
          role="menuitem"
          class="block w-full px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-neutral-100"
          :class="statusMeta(target, menuApp!.total_rounds).text"
          @click="onTerminal(menuApp, target)"
        >
          {{ statusMeta(target, menuApp!.total_rounds).label }}
          <span class="ml-1 text-[10.5px] text-neutral-400">{{ statusMeta(target, menuApp!.total_rounds).desc }}</span>
        </button>
      </div>
    </Teleport>

    <!-- 呈现设置 -->
    <Modal v-if="showSettings" title="看板呈现设置" max-width="max-w-md" @close="showSettings = false">
      <div class="space-y-5">
        <div>
          <div class="mb-2 text-[12px] font-medium text-neutral-600">视图</div>
          <div class="flex gap-2">
            <button
              v-for="mode in ([{k:'board',l:'看板视图'},{k:'list',l:'列表视图'},{k:'pipeline',l:'全流程'}] as const)"
              :key="mode.k"
              class="flex-1 rounded-lg border py-2 text-[12.5px] transition-colors"
              :class="prefs.viewMode === mode.k ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'"
              @click="prefsStore.set({ viewMode: mode.k })"
            >
              {{ mode.l }}
            </button>
          </div>
        </div>

        <div>
          <div class="mb-2 text-[12px] font-medium text-neutral-600">默认排序</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SORT_OPTIONS"
              :key="opt.key"
              class="rounded-full border px-3 py-1 text-[12px] transition-colors"
              :class="prefs.sortMode === opt.key ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'"
              @click="prefsStore.set({ sortMode: opt.key })"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div>
          <div class="mb-2 text-[12px] font-medium text-neutral-600">卡片显示字段</div>
          <div class="space-y-1.5">
            <label v-for="(label, key) in FIELD_LABELS" :key="key" class="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
              <span class="text-[12.5px] text-neutral-700">{{ label }}</span>
              <input
                type="checkbox"
                class="h-4 w-4 accent-neutral-900"
                :checked="prefs.showFields[key]"
                @change="prefsStore.setField(key, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-neutral-200 pt-3">
          <button class="text-[12px] text-neutral-400 hover:text-neutral-900" @click="prefsStore.reset()">
            恢复默认
          </button>
          <button class="rounded-lg border border-neutral-900 px-4 py-1.5 text-[12.5px] text-neutral-900" @click="showSettings = false">
            完成
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
