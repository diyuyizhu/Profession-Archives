/**
 * 投递领域 store（模块 B）：localStorage 持久化 + 状态机迁移 + 事件日志。
 * 后端（@pa/server）就绪后可切为 API 调用，契约已对齐 @pa/shared。
 */
import type {
  Application,
  ApplicationBoard,
  ApplicationEvent,
  ApplicationPayload,
  ApplicationStatus,
  ApplicationStats,
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
import { localToday } from '@pa/shared/utils'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { buildDemoApplications, buildDemoEvents } from '@/data/applications'
import { uid } from '@/data/seed'

const APPS_KEY = 'pa-applications-v1'
const EVENTS_KEY = 'pa-application-events-v1'

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

/**
 * 结构校验：坏数据宁可丢弃，也不要让模板访问 undefined 导致白屏。
 * 过滤未知状态、补齐缺失字段默认值。
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
      url: typeof a.url === 'string' ? a.url : undefined,
      jd: typeof a.jd === 'string' ? a.jd : undefined,
      channel: typeof a.channel === 'string' ? a.channel : undefined,
      status: a.status as ApplicationStatus,
      tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string') : [],
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

/** 可迁移到的目标状态（看板卡片"推进 / 终态"菜单）；传入 total_rounds 决定最后一轮 */
export function transitionTargets(
  status: ApplicationStatus,
  totalRounds = 3,
): ApplicationStatus[] {
  if (isTerminal(status)) return []
  const next = nextStage(status, totalRounds)
  const targets: ApplicationStatus[] = next ? [next] : []
  targets.push('offer', 'rejected', 'withdrawn')
  return targets
}

export const useApplicationStore = defineStore('application', () => {
  // 首次运行（无投递数据）：投递与事件用同一份 demo 引用，
  // 保证漏斗"曾经到达"精确；非首次则读存储并经结构校验。
  const storedApps = load<Application[]>(APPS_KEY)
  const storedEvents = load<ApplicationEvent[]>(EVENTS_KEY)
  const firstRun = storedApps === null

  const applications = ref<Application[]>(sanitizeApplications(storedApps ?? buildDemoApplications()))
  const events = ref<ApplicationEvent[]>(
    storedEvents
      ? sanitizeEvents(storedEvents)
      : firstRun
        ? buildDemoEvents(applications.value)
        : [],
  )

  // 实时反映：一旦有了投递即视为自定义数据（避免首次加载后仍报 demo）
  const hasCustomData = computed(() => !firstRun || applications.value.length > 0)

  const board = computed<ApplicationBoard>(() => groupByStatus(applications.value))
  const stats = computed<ApplicationStats>(() =>
    buildApplicationStats(applications.value, events.value),
  )
  /** 看板列（数据驱动：前置 + 实际用到的轮次 + 终态） */
  const boardStatuses = computed(() => boardStages(applications.value))
  const total = computed(() => applications.value.length)

  function persist(): void {
    save(APPS_KEY, applications.value)
    save(EVENTS_KEY, events.value)
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

  /** 新建投递：默认入备选池；带 applied_at 则视为已投 */
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
    if (app.status !== 'backlog') logEvent(app.id, null, app.status)
    persist()
    return app
  }

  /** 更新投递字段（不含状态迁移，见 transition） */
  function updateApplication(id: string, patch: Partial<Omit<ApplicationPayload, 'status'>>): void {
    const app = applications.value.find((a) => a.id === id)
    if (!app) return
    clampApp(patch as { total_rounds?: unknown; importance?: unknown })
    touch(app, patch)
    persist()
  }

  /** 删除投递及其事件 */
  function removeApplication(id: string): void {
    applications.value = applications.value.filter((a) => a.id !== id)
    events.value = events.value.filter((e) => e.application_id !== id)
    persist()
  }

  /**
   * 状态迁移（C2 面试结果自动推进也走这里）：
   * 非法迁移静默拒绝并返回 false，合法则写事件日志。
   * 迁移到 rejected 时可携带 reject_reason（F1 失败原因分布依据）。
   */
  function transition(id: string, to: ApplicationStatus, note?: string, rejectReason?: string): boolean {
    const app = applications.value.find((a) => a.id === id)
    if (!app || !canTransition(app.status, to)) return false
    logEvent(app.id, app.status, to, note)
    touch(app, { status: to })
    if (to === 'rejected') touch(app, { reject_reason: rejectReason?.trim() || undefined })
    if (to === 'applied' && !app.applied_at) touch(app, { applied_at: localToday() })
    persist()
    return true
  }

  /** 推进到下一阶段；已在终态 / 最后一轮（按投递 total_rounds）则无动作 */
  function advance(id: string): boolean {
    const app = applications.value.find((a) => a.id === id)
    if (!app) return false
    const next = nextStage(app.status, app.total_rounds ?? 3)
    if (!next) return false
    return transition(id, next)
  }

  /** 批量重置为 demo 数据 */
  function resetToDemo(): void {
    applications.value = buildDemoApplications()
    events.value = buildDemoEvents(applications.value)
    persist()
  }

  /** 清空全部投递 */
  function clearAll(): void {
    applications.value = []
    events.value = []
    persist()
  }

  return {
    applications,
    events,
    board,
    boardStatuses,
    stats,
    total,
    hasCustomData,
    addApplication,
    updateApplication,
    removeApplication,
    transition,
    advance,
    resetToDemo,
    clearAll,
  }
})
