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
import Modal from '@/components/Modal.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import { transitionTargets, useApplicationStore } from '@/stores/application'
import { useArchivesStore } from '@/stores/archives'
import { FIELD_LABELS, useBoardPrefsStore } from '@/stores/boardPrefs'
import { useInterviewStore } from '@/stores/interview'
import { useQuestionBankStore } from '@/stores/questionBank'

const store = useApplicationStore()
const prefsStore = useBoardPrefsStore()
const prefs = prefsStore.prefs
const router = useRouter()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'board', label: '看板', path: '/tracking' },
  { id: 'collect', label: '岗位采集', path: '/tracking/collect' },
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

const filteredApps = computed(() =>
  store.applications.filter((a) => {
    if (search.value.trim()) {
      const kw = search.value.trim().toLowerCase()
      const hay = `${a.company} ${a.title} ${a.notes} ${a.jd ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    if (filterChannel.value && a.channel !== filterChannel.value) return false
    if (filterTags.value.size && !a.tags.some((t) => filterTags.value.has(t))) return false
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

function toggleView(): void {
  prefsStore.set({ viewMode: prefs.viewMode === 'board' ? 'list' : 'board' })
}

function toggleTag(t: string): void {
  if (filterTags.value.has(t)) filterTags.value.delete(t)
  else filterTags.value.add(t)
}

function clearFilters(): void {
  search.value = ''
  filterChannel.value = null
  filterTags.value = new Set()
}

function countOf(status: ApplicationStatus): number {
  return (board.value[status] ?? []).length
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
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-8">
      <!-- 头部 -->
      <PageHeader code="B1" title="投递看板" :desc="`状态自动流转 · 共 ${store.total} 条投递`">
        <RouterLink to="/tracking/collect" class="btn-primary-trae">＋ 新建投递</RouterLink>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- 筛选栏 -->
      <section class="card-glass mb-5 space-y-2.5 p-3" style="backdrop-filter: blur(28px) saturate(1.6)">
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
          <button
            class="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[12px] text-[rgba(245,249,254,0.6)] transition-colors hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
            @click="toggleView"
          >
            {{ prefs.viewMode === 'board' ? '☷ 列表视图' : '▦ 看板视图' }}
          </button>
          <button
            class="rounded-lg border border-[rgba(50,240,140,0.35)] bg-[rgba(50,240,140,0.06)] px-3 py-1.5 text-[12px] font-medium text-[#32f08c]"
            @click="showSettings = true"
          >
            ⚙ 呈现设置
          </button>
          <button
            v-if="search || filterChannel || filterTags.size"
            class="rounded-lg px-2 py-1.5 text-[12px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]"
            @click="clearFilters"
          >
            清除筛选
          </button>
        </div>

        <!-- 标签分类 -->
        <div v-if="allTags.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-[rgba(245,249,254,0.35)]">标签：</span>
          <button
            v-for="t in allTags"
            :key="t"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="
              filterTags.has(t)
                ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]'
                : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.04)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'
            "
            @click="toggleTag(t)"
          >
            #{{ t }}
          </button>
        </div>

        <!-- 排序 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] text-[rgba(245,249,254,0.35)]">排序：</span>
          <button
            v-for="opt in SORT_OPTIONS"
            :key="opt.key"
            class="rounded-full px-2.5 py-0.5 text-[11.5px] transition-colors"
            :class="
              prefs.sortMode === opt.key
                ? 'bg-[rgba(50,240,140,0.15)] text-[#32f08c]'
                : 'text-[rgba(245,249,254,0.5)] hover:text-[#f5f9fe]'
            "
            @click="prefsStore.set({ sortMode: opt.key })"
          >
            {{ opt.label }}
          </button>
          <span class="ml-auto font-mono text-[11px] text-[rgba(245,249,254,0.3)]">
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
            class="flex w-[252px] shrink-0 flex-col rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(18,20,24,0.25)]"
          >
            <div class="flex items-center gap-2 px-3 py-3">
              <span class="h-2 w-2 rounded-full" :class="statusMeta(status).dot" />
              <span class="text-[13px] font-semibold text-[#f5f9fe]">{{ statusMeta(status).label }}</span>
              <span class="font-mono text-[11px] text-[rgba(245,249,254,0.35)]">{{ countOf(status) }}</span>
              <span v-if="statusMeta(status).terminal" class="ml-auto text-[10px] text-[rgba(245,249,254,0.3)]">终态</span>
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
                    <div class="truncate text-[14px] font-semibold text-[#f5f9fe]">
                      {{ app.title || '未命名岗位' }}
                    </div>
                    <div class="mt-0.5 truncate text-[12px] text-[rgba(245,249,254,0.5)]">
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
                <div v-if="prefs.showFields.importance && app.importance" class="mt-1.5 text-[11px] text-[#fbbf24]">
                  {{ '★'.repeat(app.importance) }}<span class="text-[rgba(245,249,254,0.3)]">{{ '☆'.repeat(5 - app.importance) }}</span>
                </div>
                <div v-if="(prefs.showFields.channel && app.channel) || (prefs.showFields.date && app.applied_at)" class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span v-if="prefs.showFields.channel && app.channel" class="text-[11px] text-[rgba(245,249,254,0.4)]">📌 {{ app.channel }}</span>
                  <span v-if="prefs.showFields.date && app.applied_at" class="font-mono text-[11px] text-[rgba(245,249,254,0.35)]">{{ app.applied_at }}</span>
                </div>
                <div v-if="prefs.showFields.tags && app.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="t in app.tags"
                    :key="t"
                    class="rounded bg-[rgba(50,240,140,0.08)] px-1.5 py-0.5 text-[10.5px] text-[#60f2bd]"
                  >
                    #{{ t }}
                  </span>
                </div>
                <p v-if="prefs.showFields.notes && app.notes" class="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
                  {{ app.notes }}
                </p>

                <!-- 操作 -->
                <div class="mt-3 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-2.5" @click.stop>
                  <button
                    v-if="canAdvance(app)"
                    class="text-[12px] font-medium text-[#32f08c] transition-colors hover:text-[#60f2bd]"
                    @click="onAdvance(app)"
                  >
                    推进 ▸
                  </button>
                  <span v-else class="text-[12px] text-[rgba(245,249,254,0.25)]">
                    {{ statusMeta(app.status, app.total_rounds).terminal ? '已结束' : '最后一轮 · 待定' }}
                  </span>

                  <div class="relative flex items-center gap-2">
                    <button
                      class="rounded px-1.5 py-0.5 text-[11px] text-[rgba(245,249,254,0.4)] transition-colors hover:text-[#f5f9fe]"
                      @click="editing = app"
                    >
                      编辑
                    </button>
                    <button
                      class="rounded px-1.5 py-0.5 text-[11px] text-[rgba(245,249,254,0.4)] transition-colors hover:text-[#f87171]"
                      @click="onRemove(app)"
                    >
                      删除
                    </button>
                    <button
                      v-if="!statusMeta(app.status, app.total_rounds).terminal"
                      data-menu-trigger
                      aria-haspopup="menu"
                      :aria-expanded="openMenuId === app.id"
                      class="rounded border border-[rgba(255,255,255,0.1)] px-2 py-0.5 text-[11px] text-[rgba(245,249,254,0.5)] transition-colors hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
                      @click="toggleMenu(app, $event)"
                    >
                      标记 ▾
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!(board[status] ?? []).length" class="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-3 py-6 text-center text-[11.5px] text-[rgba(245,249,254,0.25)]">
                暂无投递
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════ 列表视图 ═══════ -->
      <section v-else class="card-glass overflow-x-auto p-2">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-[rgba(255,255,255,0.08)] text-[11px] text-[rgba(245,249,254,0.4)]">
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
              class="cursor-pointer border-b border-[rgba(255,255,255,0.04)] transition-colors last:border-0 hover:bg-[rgba(237,239,242,0.04)]"
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
                <div class="text-[12.5px] font-medium text-[#f5f9fe]">{{ app.title }}</div>
                <div class="text-[11px] text-[rgba(245,249,254,0.4)]">{{ app.company }}</div>
              </td>
              <td class="py-2.5 pr-3 text-[12px] text-[rgba(245,249,254,0.55)]">{{ app.channel || '—' }}</td>
              <td class="py-2.5 pr-3 font-mono text-[11.5px] text-[rgba(245,249,254,0.5)]">{{ app.applied_at || '—' }}</td>
              <td class="py-2.5 pr-3 text-[11.5px] text-[#fbbf24]">
                {{ app.importance ? '★'.repeat(app.importance) : '—' }}
              </td>
              <td class="py-2.5 pr-3">
                <div class="flex flex-wrap gap-1">
                  <span v-for="t in app.tags" :key="t" class="rounded bg-[rgba(50,240,140,0.08)] px-1 py-0.5 text-[10px] text-[#60f2bd]">#{{ t }}</span>
                </div>
              </td>
              <td class="py-2.5 pr-3 font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                {{ app.updated_at.slice(0, 10) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!sortedApps.length" class="py-10 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
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
        class="fixed z-50 w-[150px] overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#14171b] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
      >
        <button
          v-for="target in menuTargets"
          :key="target"
          role="menuitem"
          class="block w-full px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[rgba(237,239,242,0.06)]"
          :class="statusMeta(target, menuApp!.total_rounds).text"
          @click="onTerminal(menuApp, target)"
        >
          {{ statusMeta(target, menuApp!.total_rounds).label }}
          <span class="ml-1 text-[10.5px] text-[rgba(245,249,254,0.3)]">{{ statusMeta(target, menuApp!.total_rounds).desc }}</span>
        </button>
      </div>
    </Teleport>

    <!-- 呈现设置 -->
    <Modal v-if="showSettings" title="看板呈现设置" max-width="max-w-md" @close="showSettings = false">
      <div class="space-y-5">
        <div>
          <div class="mb-2 text-[12px] font-medium text-[rgba(245,249,254,0.6)]">视图</div>
          <div class="flex gap-2">
            <button
              v-for="mode in ([{k:'board',l:'看板视图'},{k:'list',l:'列表视图'}] as const)"
              :key="mode.k"
              class="flex-1 rounded-lg border py-2 text-[12.5px] transition-colors"
              :class="prefs.viewMode === mode.k ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]' : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)]'"
              @click="prefsStore.set({ viewMode: mode.k })"
            >
              {{ mode.l }}
            </button>
          </div>
        </div>

        <div>
          <div class="mb-2 text-[12px] font-medium text-[rgba(245,249,254,0.6)]">默认排序</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SORT_OPTIONS"
              :key="opt.key"
              class="rounded-full border px-3 py-1 text-[12px] transition-colors"
              :class="prefs.sortMode === opt.key ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]' : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)]'"
              @click="prefsStore.set({ sortMode: opt.key })"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div>
          <div class="mb-2 text-[12px] font-medium text-[rgba(245,249,254,0.6)]">卡片显示字段</div>
          <div class="space-y-1.5">
            <label v-for="(label, key) in FIELD_LABELS" :key="key" class="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[rgba(237,239,242,0.04)]">
              <span class="text-[12.5px] text-[rgba(245,249,254,0.7)]">{{ label }}</span>
              <input
                type="checkbox"
                class="h-4 w-4 accent-[#32f08c]"
                :checked="prefs.showFields[key]"
                @change="prefsStore.setField(key, ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-3">
          <button class="text-[12px] text-[rgba(245,249,254,0.4)] hover:text-[#f5f9fe]" @click="prefsStore.reset()">
            恢复默认
          </button>
          <button class="rounded-lg border border-[rgba(50,240,140,0.4)] px-4 py-1.5 text-[12.5px] text-[#32f08c]" @click="showSettings = false">
            完成
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>
