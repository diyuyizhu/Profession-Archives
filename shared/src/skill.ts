/**
 * 技能成长聚合（F3 提升追踪）—— 纯函数，前端/服务端共用。
 */
import type { SkillSnapshot } from './index.js'

/** 单一技能的历史轨迹（按时间正序） */
export interface SkillHistory {
  skill: string
  history: Array<{ recorded_at: string; level: number; note?: string }>
  /** 当前（最近一次）水平 */
  current: number
}

/** 按技能名分组快照，技能按当前水平降序，组内按时间正序 */
export function groupSkillHistory(snapshots: SkillSnapshot[]): SkillHistory[] {
  const map = new Map<string, SkillSnapshot[]>()
  for (const snap of snapshots) {
    const list = map.get(snap.skill)
    if (list) list.push(snap)
    else map.set(snap.skill, [snap])
  }
  return [...map.entries()]
    .map(([skill, list]) => {
      const sorted = [...list].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1))
      return {
        skill,
        history: sorted.map((s) => ({ recorded_at: s.recorded_at, level: s.level, note: s.note })),
        current: sorted[sorted.length - 1]?.level ?? 1,
      }
    })
    .sort((a, b) => b.current - a.current || a.skill.localeCompare(b.skill, 'zh-CN'))
}

/** 学习计划总进度：已完成任务数 / 总数（0 任务返回 0） */
export function planProgress(plan: { tasks: Array<{ done: boolean }> }): {
  done: number
  total: number
  pct: number
} {
  const total = plan.tasks.length
  const done = plan.tasks.filter((t) => t.done).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}
