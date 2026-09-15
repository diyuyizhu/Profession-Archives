/**
 * 求职投递领域聚合（B1 看板列 / B4 统计 / F1 漏斗共用）。
 * 纯函数，无副作用 —— 前端 localStorage 版与 server 版均引用。
 *
 * 看板列模型见 shared/board.ts：列由用户自定义（顺序 / 增删 / 改名），
 * 投递的 `status` 即「所在列 id」：
 * - 推进 = 下一列（按列顺序）
 * - 终态 = 列角色 success / failure / archived
 * 列注册表由 application store 在列变化时写入，未初始化时回退内置默认列。
 */
import {
  columnIndex,
  columnMeta,
  ensureColumnsForData,
  getActiveBoardColumns,
  isTerminalColumn,
  isValidColumnId,
  nextColumnId,
} from './board.js'
import type {
  Application,
  ApplicationBoard,
  ApplicationEvent,
  ApplicationStatus,
  ApplicationStatusMeta,
  ApplicationStats,
} from './index.js'
import { MAX_ROUNDS, type RoundStage } from './index.js'

export { columnMeta, getActiveBoardColumns }

/** 是否终态列（success / failure / archived） */
export function isTerminal(status: ApplicationStatus): boolean {
  return isTerminalColumn(status)
}

/**
 * 是否为合法列 id。
 * 列可自定义 → 只做结构校验（非空 / 长度 / 无控制字符）；
 * 数据里出现的未知列会被 board 层自动补成列，避免卡片丢失。
 */
export function isValidStatus(s: string): boolean {
  return isValidColumnId(s)
}

/** 是否动态轮次列（round_1 .. round_8）—— 用于识别历史/预设的面试轮次命名 */
export function isRound(status: ApplicationStatus): status is RoundStage {
  if (typeof status !== 'string' || !/^round_\d+$/.test(status)) return false
  const r = Number(status.slice('round_'.length))
  return Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS
}

/** 轮次序号（round_i → i；非轮次返回 null） */
export function roundOf(status: ApplicationStatus): number | null {
  if (!isRound(status)) return null
  return Number(status.slice('round_'.length))
}

/** 列序号（不在当前列里返回 -1）—— 漏斗比较 / 顺序判断用 */
export function stageIndex(status: ApplicationStatus): number {
  return columnIndex(status)
}

/**
 * 列元信息（列头 / 徽章共用）：标签取列名，配色取列角色。
 * `totalRounds` 参数保留仅为兼容既有调用点（旧状态机用它判断「终面」，
 * 自定义列下以列名为准，不再由轮数推导）。
 */
export function statusMeta(status: ApplicationStatus, totalRounds = MAX_ROUNDS): ApplicationStatusMeta {
  void totalRounds
  return columnMeta(status)
}

/**
 * 下一个流程阶段（看板「推进」用）：下一个进行中列；已是最后一个进行中列 → 成功列；
 * 终态列 → null（终态不再自动推进）。
 */
export function nextStage(
  status: ApplicationStatus,
  totalRounds = MAX_ROUNDS,
): ApplicationStatus | null {
  void totalRounds
  return nextColumnId(status)
}

/**
 * 校验一次迁移是否合法。
 * 列由用户自定义后改为**自由移动**（看板语义：可前进、可回退、可从终态拉回修正），
 * 仅拦截「原地不动」与非法列 id。
 */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return isValidColumnId(to) && from !== to
}

/** 失败原因分布（F1）：拒绝列投递按原因归类计数，未填写归「未说明」 */
export function buildRejectionReasons(apps: Application[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>()
  for (const app of apps) {
    if (app.status !== 'rejected') continue
    const reason = app.reject_reason?.trim() || '未说明'
    map.set(reason, (map.get(reason) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

/** 实际生效的看板列：用户配置 + 数据里出现但配置缺失的列（自动补，插在终态列前） */
export function resolveBoardColumns(apps: Application[]): ReturnType<typeof ensureColumnsForData> {
  return ensureColumnsForData(getActiveBoardColumns(), apps)
}

/** 看板列 id（按顺序） */
export function boardStages(apps: Application[]): ApplicationStatus[] {
  return resolveBoardColumns(apps).map((c) => c.id)
}

/** 把一组投递按所在列分组 */
export function groupByStatus(apps: Application[]): ApplicationBoard {
  const board: ApplicationBoard = {}
  for (const status of boardStages(apps)) board[status] = []
  for (const app of apps) {
    const bucket = board[app.status]
    if (bucket) bucket.push(app)
    else board[app.status] = [app]
  }
  return board
}

/**
 * 计算投递统计（B4 / F1 数据源）。
 * 漏斗「曾经到达」：优先用事件日志精确还原（创建 → 各阶段 → 终态），
 * 无事件的旧数据回退用当前所在列估算。
 */
export function buildApplicationStats(
  apps: Application[],
  events: ApplicationEvent[],
): ApplicationStats {
  const stages = boardStages(apps)
  const byStatus: Record<string, number> = {}
  for (const status of stages) byStatus[status] = 0
  for (const app of apps) byStatus[app.status] = (byStatus[app.status] ?? 0) + 1

  // 每个投递曾经到达的列（含终态）。
  // 同时计入非空 ev.from：迁移时 from 也是真实待过的列（如 backlog→rejected，
  // 只有一条事件时 to 是终态、序号靠后，若不记 from 会把这投递在漏斗里全部算成 0）。
  const reached = new Map<string, Set<string>>()
  for (const app of apps) reached.set(app.id, new Set())
  for (const ev of events) {
    const set = reached.get(ev.application_id)
    if (!set) continue
    set.add(ev.to)
    if (ev.from) set.add(ev.from)
  }

  // 漏斗：每个进行中列「曾经到达」的数量
  const funnel: ApplicationStats['funnel'] = stages
    .filter((s) => !isTerminal(s))
    .map((status) => {
      const idx = stageIndex(status)
      const count = apps.filter((app) => {
        const set = reached.get(app.id)
        if (set && set.size > 0) {
          // 事件轨迹：取到达过的最大进行中列序号（终态事件序号为 -1，不会抬高漏斗），
          // 并计入当前列（部分投递被直接编辑/导入，事件不全但已到达）。
          let furthest = -1
          for (const s of set) {
            if (isTerminal(s)) continue
            const i = stageIndex(s)
            if (i > furthest) furthest = i
          }
          return Math.max(furthest, isTerminal(app.status) ? -1 : stageIndex(app.status)) >= idx
        }
        // 无事件（如备选池新条目）：按当前列估算
        return !isTerminal(app.status) && stageIndex(app.status) >= idx
      }).length
      return { status, label: statusMeta(status).label, count }
    })

  const channelCount = new Map<string, number>()
  for (const app of apps) {
    const c = app.channel?.trim() || '未标注'
    channelCount.set(c, (channelCount.get(c) ?? 0) + 1)
  }
  const byChannel = [...channelCount.entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)

  const monthCount = new Map<string, number>()
  for (const app of apps) {
    if (!app.applied_at) continue
    const month = app.applied_at.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    monthCount.set(month, (monthCount.get(month) ?? 0) + 1)
  }
  // 近 12 个月（含无投递的月份），倒序展示（最新月份在前）
  const byMonth: ApplicationStats['byMonth'] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth.push({ month: key, count: monthCount.get(key) ?? 0 })
  }

  return { byStatus, funnel, byChannel, byMonth }
}
