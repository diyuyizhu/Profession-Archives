/**
 * 投递领域 store（模块 B）：localStorage 持久化 + 看板列管理 + 卡片迁移 + 事件日志。
 * 后端（@pa/server）就绪后可切为 API 调用，契约已对齐 @pa/shared。
 *
 * 看板列（B1）：列由用户自定义（顺序 / 增删 / 改名 / 角色），投递的 status = 所在列 id。
 * 列配置存 `pa-board-columns-v1`；shared 的列注册表由本 store 同步（见 resolvedColumns）。
 */
import type {
  Application,
  ApplicationBoard,
  ApplicationEvent,
  ApplicationPayload,
  ApplicationStatus,
  ApplicationStats,
  BoardColumn,
  BoardRole,
  PropertyValue,
  PropertyValues,
} from '@pa/shared'
import {
  boardStages,
  buildApplicationStats,
  canTransition,
  groupByStatus,
  isTerminal,
  isValidStatus,
  nextStage,
} from '@pa/shared/application'
import {
  DEFAULT_BOARD_COLUMNS,
  activeColumn,
  createColumn,
  ensureColumnsForData,
  getActiveBoardColumns,
  moveColumn as moveColumnAt,
  normalizeBoardColumns,
  setActiveBoardColumns,
} from '@pa/shared/board'
import { localToday } from '@pa/shared/utils'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const APPS_KEY = 'pa-applications-v1'
const EVENTS_KEY = 'pa-application-events-v1'
const COLUMNS_KEY = 'pa-board-columns-v1'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    // 存储不可用 / 配额满：上抛给调用方（视图）提示，避免静默丢失
    console.error(`[application] 保存 ${key} 失败`, err)
    throw err
  }
}

function defaultColumns(): BoardColumn[] {
  return DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c }))
}

/** 自定义属性值结构校验（只保留标量 / 字符串数组） */
function sanitizeProperties(raw: unknown): PropertyValues | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: PropertyValues = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * 结构校验：坏数据宁可丢弃，也不要让模板访问 undefined 导致白屏。
 * 状态列已自定义，故只做结构校验（未知列会被自动补列，不会丢卡片）。
 */
function sanitizeApplications(list: unknown): Application[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
    .filter((a) => {
      const s = a.status
      return typeof s === 'string' && isValidStatus(s)
    })
    .map((a) => ({
      id: String(a.id ?? uid('ap')),
      company: typeof a.company === 'string' ? a.company : '',
      title: typeof a.title === 'string' ? a.title : '',
      apply_method: typeof a.apply_method === 'string' ? (a.apply_method as Application['apply_method']) : undefined,
      url: typeof a.url === 'string' ? a.url : undefined,
      jd: typeof a.jd === 'string' ? a.jd : undefined,
      channel: typeof a.channel === 'string' ? a.channel : undefined,
      status: String(a.status).trim(),
      tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string') : [],
      groups: Array.isArray(a.groups) ? a.groups.filter((g): g is string => typeof g === 'string') : [],
      notes: typeof a.notes === 'string' ? a.notes : '',
      total_rounds:
        typeof a.total_rounds === 'number'
          ? Math.max(1, Math.min(8, Math.round(a.total_rounds)))
          : undefined,
      importance:
        typeof a.importance === 'number'
          ? Math.max(1, Math.min(5, Math.round(a.importance)))
          : undefined,
      email_thread: typeof a.email_thread === 'string' ? a.email_thread : undefined,
      reject_reason: typeof a.reject_reason === 'string' ? a.reject_reason : undefined,
      applied_at: typeof a.applied_at === 'string' ? a.applied_at : undefined,
      properties: sanitizeProperties(a.properties),
      created_at: typeof a.created_at === 'string' ? a.created_at : ts,
      updated_at: typeof a.updated_at === 'string' ? a.updated_at : ts,
    }))
}

/** 事件结构校验：过滤脏事件（to/from 状态合法、application_id/at 存在） */
function sanitizeEvents(list: unknown): ApplicationEvent[] {
  if (!Array.isArray(list)) return []
  return list.filter((e): e is ApplicationEvent => {
    if (!e || typeof e !== 'object') return false
    const ev = e as Record<string, unknown>
    const to = ev.to
    const from = ev.from
    return (
      typeof to === 'string' &&
      isValidStatus(to) &&
      (from === null || from === undefined || (typeof from === 'string' && isValidStatus(from))) &&
      typeof ev.application_id === 'string' &&
      typeof ev.at === 'string'
    )
  })
}

/** 数值字段 clamp（写入路径与 sanitize 一致） */
function clampApp(patch: { total_rounds?: unknown; importance?: unknown }): void {
  if (typeof patch.total_rounds === 'number') {
    patch.total_rounds = Math.max(1, Math.min(8, Math.round(patch.total_rounds)))
  }
  if (typeof patch.importance === 'number') {
    patch.importance = Math.max(1, Math.min(5, Math.round(patch.importance)))
  }
}

/** 该列是否为失败列（拒绝原因随失败列记录，F1 失败原因分布依据） */
function isFailureColumn(id: ApplicationStatus): boolean {
  return activeColumn(id)?.role === 'failure'
}

/** 删列时列内卡片的处置方案 */
export type ColumnRemovalPlan =
  /** 全部迁到目标列（写事件日志，漏斗仍可追溯） */
  | { mode: 'move'; targetId: string }
  /** 连同卡片一起删除 */
  | { mode: 'delete' }
  /** 逐卡指定：目标列 id 或 'delete' */
  | { mode: 'perCard'; assignments: Record<string, string | 'delete'> }

export const useApplicationStore = defineStore('application', () => {
  // 首次运行（无投递数据）：空看板开始；非首次则读存储并经结构校验。
  const storedApps = load<Application[]>(APPS_KEY)
  const storedEvents = load<ApplicationEvent[]>(EVENTS_KEY)
  const firstRun = storedApps === null

  const applications = ref<Application[]>(sanitizeApplications(storedApps ?? []))
  const events = ref<ApplicationEvent[]>(storedEvents ? sanitizeEvents(storedEvents) : [])
  const storedColumns = normalizeBoardColumns(load<unknown>(COLUMNS_KEY))
  const columns = ref<BoardColumn[]>(storedColumns.length ? storedColumns : defaultColumns())

  // 实时反映：一旦有了投递即视为自定义数据
  const hasCustomData = computed(() => !firstRun || applications.value.length > 0)

  /**
   * 实际生效的列 = 用户配置 + 数据里出现但配置缺失的列（自动补，防卡片丢失）。
   * 顺带把结果写入 shared 的列注册表 —— shared 的 statusMeta / isTerminal /
   * stageIndex 等按「当前列」解释 status，注册表必须与视图用到的列一致。
   * 其它 computed 通过读取本值建立依赖，保证注册表先于它们更新。
   */
  const resolvedColumns = computed<BoardColumn[]>(() => {
    const resolved = ensureColumnsForData(columns.value, applications.value)
    setActiveBoardColumns(resolved)
    return resolved
  })

  const boardStatuses = computed<ApplicationStatus[]>(() => {
    void resolvedColumns.value
    return boardStages(applications.value)
  })
  const board = computed<ApplicationBoard>(() => {
    void resolvedColumns.value
    return groupByStatus(applications.value)
  })
  const stats = computed<ApplicationStats>(() => {
    void resolvedColumns.value
    return buildApplicationStats(applications.value, events.value)
  })
  const total = computed(() => applications.value.length)

  /** 首列（备选池 / 收件箱）：新建投递的默认落点 */
  const firstColumnId = computed(() => columns.value[0]?.id ?? '')
  /** 「已投」列：优先同名内置列，否则取首列之后的第一个进行中列 */
  const appliedColumnId = computed(() => {
    const named = columns.value.find((c) => c.id === 'applied')
    if (named) return named.id
    const normals = columns.value.filter((c) => c.role === 'normal')
    return (normals[1] ?? normals[0])?.id ?? firstColumnId.value
  })

  function persist(): void {
    save(APPS_KEY, applications.value)
    save(EVENTS_KEY, events.value)
  }

  function persistColumns(): void {
    save(COLUMNS_KEY, columns.value)
  }

  function touch(app: Application, patch: Partial<Application>): void {
    Object.assign(app, patch, { updated_at: new Date().toISOString() })
  }

  function logEvent(
    applicationId: string,
    from: ApplicationStatus | null,
    to: ApplicationStatus,
    note?: string,
  ): void {
    events.value.push({
      id: uid('ev'),
      application_id: applicationId,
      from,
      to,
      at: new Date().toISOString(),
      note,
    })
  }

  /* ── 投递 CRUD ─────────────────────────────────────────── */

  /** 新建投递：默认入首列（备选池）；带 applied_at 则视为已投 */
  function addApplication(draft: ApplicationPayload): Application {
    const ts = new Date().toISOString()
    clampApp(draft) // 写入路径与 sanitize 一致地 clamp 数值字段
    const app: Application = {
      id: uid('ap'),
      ...draft,
      created_at: ts,
      updated_at: ts,
    }
    applications.value.push(app)
    const first = columns.value[0]?.id
    if (app.status !== first) logEvent(app.id, null, app.status)
    persist()
    return app
  }

  /** 更新投递字段（不含列迁移，见 transition） */
  function updateApplication(id: string, patch: Partial<Omit<ApplicationPayload, 'status'>>): void {
    const app = applications.value.find((a) => a.id === id)
    if (!app) return
    clampApp(patch as { total_rounds?: unknown; importance?: unknown })
    touch(app, patch)
    persist()
  }

  /** 删除投递及其事件（关联的面试/题库/归档由视图侧一并清理） */
  function removeApplication(id: string): void {
    applications.value = applications.value.filter((a) => a.id !== id)
    events.value = events.value.filter((e) => e.application_id !== id)
    persist()
  }

  /**
   * 列迁移（看板拖拽/菜单、面试结果自动推进都走这里）：
   * 列由用户自定义 → 自由移动（可前进 / 回退 / 从终态拉回修正），
   * 非法目标或原地不动返回 false。迁移到失败列时记录 reject_reason。
   */
  function transition(id: string, to: ApplicationStatus, note?: string, rejectReason?: string): boolean {
    const app = applications.value.find((a) => a.id === id)
    if (!app || !canTransition(app.status, to)) return false
    const firstColumnId = columns.value[0]?.id
    const wasFirstColumn = app.status === firstColumnId
    logEvent(app.id, app.status, to, note)
    touch(app, { status: to })
    if (isFailureColumn(to)) touch(app, { reject_reason: rejectReason?.trim() || undefined })
    // 首次离开首列 = 真正投出去了，补投递日期
    if (wasFirstColumn && !app.applied_at) touch(app, { applied_at: localToday() })
    persist()
    return true
  }

  /** 推进到下一列；已是终态列 / 没有下一列则无动作 */
  function advance(id: string): boolean {
    const app = applications.value.find((a) => a.id === id)
    if (!app) return false
    const next = nextStage(app.status)
    if (!next) return false
    return transition(id, next)
  }

  /** 清空全部投递 */
  function clearAll(): void {
    applications.value = []
    events.value = []
    persist()
  }

  /* ── 自定义属性值（多维表格） ── */

  /** 写入一个自定义属性值；空值 = 清除该键 */
  function setProperty(id: string, propertyId: string, value: PropertyValue): void {
    const app = applications.value.find((a) => a.id === id)
    if (!app) return
    const next: PropertyValues = { ...(app.properties ?? {}) }
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) delete next[propertyId]
    else next[propertyId] = value
    app.properties = Object.keys(next).length ? next : undefined
    touch(app, {})
    persist()
  }

  /** 删除属性定义时，清掉所有投递上的该属性值 */
  function clearPropertyValues(propertyId: string): void {
    for (const app of applications.value) {
      if (!app.properties || !(propertyId in app.properties)) continue
      const next = { ...app.properties }
      delete next[propertyId]
      app.properties = Object.keys(next).length ? next : undefined
      touch(app, {})
    }
    persist()
  }

  /** 全部分组标签（去重，供筛选/管理） */
  const allGroups = computed(() => {
    const set = new Set<string>()
    for (const app of applications.value) {
      for (const g of app.groups ?? []) if (g) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  /** 批量导入：按传入列表入库（去重由调用方用 shared/dedupeImported 处理） */
  function importApplications(
    items: Array<Omit<ApplicationPayload, 'id' | 'created_at' | 'updated_at'>>,
  ): number {
    let added = 0
    for (const item of items) {
      try {
        addApplication(item)
        added++
      } catch {
        // 单条失败不影响整体导入
      }
    }
    return added
  }

  /* ── 看板列管理 ───────────────────────────────────────── */

  /** 列内卡片数量 */
  function countInColumn(columnId: string): number {
    return applications.value.filter((a) => a.status === columnId).length
  }

  function columnName(id: string): string {
    return resolvedColumns.value.find((c) => c.id === id)?.name ?? id
  }

  /** 列内全部投递 */
  function appsInColumn(columnId: string): Application[] {
    return applications.value.filter((a) => a.status === columnId)
  }

  /**
   * 新增列。
   * `presetId` 传入时「把隐藏的内置阶段加回来」（沿用历史 id，已有同 id 列则直接返回）；
   * 否则创建 `col_*` 自定义列。进行中列插在终态列之前。
   */
  function addColumn(name: string, role: BoardRole = 'normal', presetId?: string): BoardColumn {
    if (presetId) {
      const existing = columns.value.find((c) => c.id === presetId)
      if (existing) return existing
    }
    const column = presetId
      ? { id: presetId, name: name.trim() || presetId, role }
      : createColumn(name, role)
    const terminalStart = columns.value.findIndex((c) => c.role !== 'normal')
    const at = terminalStart < 0 ? columns.value.length : terminalStart
    columns.value = [...columns.value.slice(0, at), column, ...columns.value.slice(at)]
    persistColumns()
    return column
  }

  /** 改列名 / 改角色 */
  function updateColumn(id: string, patch: Partial<Pick<BoardColumn, 'name' | 'role'>>): void {
    columns.value = columns.value.map((c) => {
      if (c.id !== id) return c
      const name = patch.name !== undefined ? patch.name.trim() || c.name : c.name
      return { ...c, name, role: patch.role ?? c.role }
    })
    persistColumns()
  }

  /** 拖拽排序：把列移到指定下标 */
  function moveColumnTo(id: string, toIndex: number): void {
    const from = columns.value.findIndex((c) => c.id === id)
    if (from < 0) return
    columns.value = moveColumnAt(columns.value, from, toIndex)
    persistColumns()
  }

  /** 恢复默认列（不动投递数据；数据里出现的其它列会被自动补回） */
  function resetColumns(): void {
    columns.value = defaultColumns()
    persistColumns()
  }

  /**
   * 移除一列并处置列内卡片：
   * - move：全部迁到目标列（写事件日志）
   * - delete：连同卡片一起删除
   * - perCard：逐卡指定目标列或 'delete'（未指定的卡片会因自动补列而保留，不会丢）
   * `onDeleted` 供视图清理卡片的关联数据（面试记录 / 题库 / 归档）。
   * 返回 { moved, deleted, remaining }。
   */
  function removeColumn(
    id: string,
    plan: ColumnRemovalPlan,
    onDeleted?: (app: Application) => void,
  ): { moved: number; deleted: number; remaining: number } {
    const affected = appsInColumn(id)
    let moved = 0
    let deleted = 0
    const label = columnName(id)

    const moveOne = (app: Application, targetId: string, note: string): void => {
      if (transition(app.id, targetId, note)) moved++
    }

    if (plan.mode === 'move') {
      for (const app of affected) moveOne(app, plan.targetId, `看板列「${label}」移除后迁移`)
    } else if (plan.mode === 'delete') {
      for (const app of affected) {
        onDeleted?.(app)
        removeApplication(app.id)
        deleted++
      }
    } else {
      for (const app of affected) {
        const target = plan.assignments[app.id]
        if (!target) continue
        if (target === 'delete') {
          onDeleted?.(app)
          removeApplication(app.id)
          deleted++
        } else {
          moveOne(app, target, `看板列「${label}」移除后逐卡迁移`)
        }
      }
    }

    // 至少保留一列，否则看板无列可显示
    if (columns.value.length > 1) {
      columns.value = columns.value.filter((c) => c.id !== id)
      persistColumns()
    }
    return { moved, deleted, remaining: countInColumn(id) }
  }

  return {
    applications,
    events,
    columns,
    resolvedColumns,
    board,
    boardStatuses,
    stats,
    total,
    firstColumnId,
    appliedColumnId,
    hasCustomData,
    allGroups,
    addApplication,
    updateApplication,
    removeApplication,
    transition,
    advance,
    clearAll,
    importApplications,
    setProperty,
    clearPropertyValues,
    countInColumn,
    columnName,
    appsInColumn,
    addColumn,
    updateColumn,
    moveColumnTo,
    resetColumns,
    removeColumn,
  }
})

/** 可迁移到的目标列：下一列优先，其后是其余列（看板卡片「移动」菜单） */
export function transitionTargets(status: ApplicationStatus): ApplicationStatus[] {
  const next = nextStage(status)
  const others = getActiveBoardColumns()
    .map((c) => c.id)
    .filter((id) => id !== status && id !== next)
  return next ? [next, ...others] : others
}
