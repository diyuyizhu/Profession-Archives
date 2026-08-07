/**
 * 求职投递领域聚合（B1 状态机 / B4 统计 / F1 漏斗共用）。
 * 纯函数，无副作用 —— 前端 localStorage 版与 server 版均引用。
 * 状态机支持动态面试轮次（round_1..round_8），每个投递的 total_rounds 决定"哪一轮是终面"。
 */
import {
  APPLICATION_PREFIX_STAGES,
  APPLICATION_STATUS_META,
  APPLICATION_TERMINALS,
  MAX_ROUNDS,
  type Application,
  type ApplicationBoard,
  type ApplicationEvent,
  type ApplicationPrefixStage,
  type ApplicationStats,
  type ApplicationStatus,
  type ApplicationStatusMeta,
  type ApplicationTerminal,
  type RoundStage,
} from './index.js'

/** 是否终态 */
export function isTerminal(status: ApplicationStatus): boolean {
  return APPLICATION_TERMINALS.includes(status as (typeof APPLICATION_TERMINALS)[number])
}

/** 是否为合法状态（前置 / 动态轮次 / 终态）—— 结构校验用 */
export function isValidStatus(s: string): boolean {
  if (isTerminal(s as ApplicationStatus)) return true
  if (isRound(s as ApplicationStatus)) {
    const r = roundOf(s as ApplicationStatus)
    return r !== null && r >= 1 && r <= MAX_ROUNDS
  }
  return APPLICATION_PREFIX_STAGES.includes(s as ApplicationPrefixStage)
}

/** 是否动态轮次阶段（round_1 .. round_8） */
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

/**
 * 流程阶段序号：backlog=0 applied=1 viewed=2 round_1=3 round_2=4 …（终态返回 -1）。
 * 用于"只允许前进"的迁移校验与漏斗比较。
 */
export function stageIndex(status: ApplicationStatus): number {
  if (isTerminal(status)) return -1
  const r = roundOf(status)
  if (r !== null) return APPLICATION_PREFIX_STAGES.length - 1 + r
  return APPLICATION_PREFIX_STAGES.indexOf(status as ApplicationPrefixStage)
}

/** 轮次阶段的配色轮（最多 8 面不同色，超出取模） */
const ROUND_COLORS: Array<Pick<ApplicationStatusMeta, 'text' | 'chip' | 'dot'>> = [
  { text: 'text-[#a78bfa]', chip: 'border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.08)]', dot: 'bg-[#a78bfa]' },
  { text: 'text-[#fbbf24]', chip: 'border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)]', dot: 'bg-[#fbbf24]' },
  { text: 'text-[#f97316]', chip: 'border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.08)]', dot: 'bg-[#f97316]' },
  { text: 'text-[#38bdf8]', chip: 'border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.08)]', dot: 'bg-[#38bdf8]' },
  { text: 'text-[#f472b6]', chip: 'border-[rgba(244,114,182,0.35)] bg-[rgba(244,114,182,0.08)]', dot: 'bg-[#f472b6]' },
  { text: 'text-[#2dd4bf]', chip: 'border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.08)]', dot: 'bg-[#2dd4bf]' },
  { text: 'text-[#fb7185]', chip: 'border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.08)]', dot: 'bg-[#fb7185]' },
  { text: 'text-[#4ade80]', chip: 'border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)]', dot: 'bg-[#4ade80]' },
]

/**
 * 状态元信息：固定阶段查表，动态轮次按序号生成。
 * total_rounds 决定某轮是否"终面"（round_i 且 i ≥ total_rounds）。
 * 默认 MAX_ROUNDS：不传时任何轮次都显示"第 N 面"（非终面）；真正的"终面"
 * 由各投递卡片/徽章传入其 total_rounds 判断。
 */
export function statusMeta(status: ApplicationStatus, totalRounds = MAX_ROUNDS): ApplicationStatusMeta {
  const r = roundOf(status)
  if (r !== null) {
    const colors = ROUND_COLORS[(r - 1) % ROUND_COLORS.length]!
    const isFinal = r >= totalRounds
    return {
      label: isFinal ? '终面' : `第 ${r} 面`,
      desc: isFinal ? '最终轮面试' : `第 ${r} 轮面试`,
      terminal: false,
      ...colors,
    }
  }
  return APPLICATION_STATUS_META[status as ApplicationPrefixStage | ApplicationTerminal]
}

/**
 * 下一个流程阶段（看板"推进"用）：
 * - 前置阶段：backlog → applied → viewed → round_1
 * - 轮次：round_i → round_{i+1}；已达到 total_rounds（最后一轮）返回 null，由用户标记 Offer/拒绝
 * - 终态：null
 */
export function nextStage(
  status: ApplicationStatus,
  totalRounds = MAX_ROUNDS,
): ApplicationStatus | null {
  if (isTerminal(status)) return null
  const r = roundOf(status)
  if (r !== null) {
    if (r >= totalRounds) return null
    return `round_${r + 1}` as RoundStage
  }
  const idx = stageIndex(status)
  if (idx < 0) return null
  if (idx < APPLICATION_PREFIX_STAGES.length - 1) {
    return APPLICATION_PREFIX_STAGES[idx + 1] as ApplicationStatus
  }
  return 'round_1' as RoundStage
}

/**
 * 校验一次迁移是否合法：
 * - 阶段只允许前进（索引更大）；
 * - 任意状态 → 终态 都允许；
 * - 其余（后退 / 终态再出发）不允许。
 */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (isTerminal(from)) return false
  if (isTerminal(to)) return true
  return stageIndex(to) > stageIndex(from)
}

/** 失败原因分布（F1）：拒绝投递按原因归类计数，未填写归「未说明」 */
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

/**
 * 看板列（数据驱动）：前置阶段 + 实际用到的轮次列 + 终态。
 * 轮次上限取 max(当前轮次, total_rounds)——终态/进行中的投递也按其预期轮数保留列，
 * 避免"曾经到达"的轮次从漏斗/列中丢失。
 */
export function boardStages(apps: Application[]): ApplicationStatus[] {
  let maxRound = 1
  for (const app of apps) {
    const r = roundOf(app.status)
    if (r !== null && r > maxRound) maxRound = r
    const tr = app.total_rounds
    if (tr !== undefined && tr > maxRound) maxRound = Math.min(tr, MAX_ROUNDS)
  }
  const max = Math.max(1, Math.min(maxRound, MAX_ROUNDS))
  const rounds = Array.from({ length: max }, (_, i) => `round_${i + 1}` as RoundStage)
  return [...APPLICATION_PREFIX_STAGES, ...rounds, ...APPLICATION_TERMINALS]
}

/** 把一组投递按当前状态分组为看板列 */
export function groupByStatus(apps: Application[]): ApplicationBoard {
  const board = {} as ApplicationBoard
  for (const status of boardStages(apps)) {
    board[status] = apps.filter((a) => a.status === status)
  }
  return board
}

/**
 * 计算投递统计（B4 / F1 数据源）。
 * 漏斗"曾经到达"：优先用事件日志精确还原（创建 → 各阶段 → 终态），
 * 无事件的旧数据回退用当前状态估算。
 */
export function buildApplicationStats(
  apps: Application[],
  events: ApplicationEvent[],
): ApplicationStats {
  const stages = boardStages(apps)
  const byStatus = {} as Record<ApplicationStatus, number>
  for (const status of stages) byStatus[status] = 0
  for (const app of apps) byStatus[app.status] = (byStatus[app.status] ?? 0) + 1

  // 每个投递曾经到达的状态（含终态）。
  // 同时计入非空 ev.from：状态迁移时 from 也是真实待过的阶段（如 backlog→rejected，
  // 只有一条事件时 to 是终态、stageIndex=-1，若不记 from 会把这投递在漏斗里全部算成 0）。
  const reached = new Map<string, Set<ApplicationStatus>>()
  for (const app of apps) reached.set(app.id, new Set())
  for (const ev of events) {
    const set = reached.get(ev.application_id)
    if (!set) continue
    set.add(ev.to)
    if (ev.from) set.add(ev.from)
  }

  // 漏斗：每个非终态阶段"曾经到达"的数量
  const funnel: ApplicationStats['funnel'] = stages
    .filter((s) => !isTerminal(s))
    .map((status) => {
      const idx = stageIndex(status)
      const count = apps.filter((app) => {
        const set = reached.get(app.id)
        if (set && set.size > 0) {
          // 事件轨迹：取到达过的最大非终态阶段（终态事件 index=-1，不会抬高漏斗），
          // 并计入当前状态（部分投递状态被直接编辑/导入，事件不全但已到达）。
          let furthest = -1
          for (const s of set) {
            const i = stageIndex(s)
            if (i > furthest) furthest = i
          }
          return Math.max(furthest, stageIndex(app.status)) >= idx
        }
        // 无事件（如备选池新条目）：按当前状态估算
        return stageIndex(app.status) >= idx
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
