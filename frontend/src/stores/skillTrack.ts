/**
 * 技能追踪 store（模块 F3）：技能熟练度快照 + 演化历史，localStorage 持久化。
 * 由 shared/skill 纯函数聚合为轨迹。
 */
import type { SkillSnapshot, SkillSnapshotPayload } from '@pa/shared'
import { groupSkillHistory } from '@pa/shared/skill'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-skill-snapshots-v1'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 结构校验：坏数据宁可丢弃，避免模板访问 undefined 白屏 */
function sanitize(list: unknown): SkillSnapshot[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter(
      (s): s is Record<string, unknown> =>
        Boolean(s) && typeof s === 'object' && typeof s.skill === 'string',
    )
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : uid('ss'),
      skill: s.skill as string,
      level: typeof s.level === 'number' ? Math.max(1, Math.min(5, s.level)) : 1,
      recorded_at: typeof s.recorded_at === 'string' ? s.recorded_at : ts.slice(0, 10),
      note: typeof s.note === 'string' ? s.note : undefined,
    }))
}

export const useSkillTrackStore = defineStore('skillTrack', () => {
  const snapshots = ref<SkillSnapshot[]>(sanitize(load(KEY)))

  const history = computed(() => groupSkillHistory(snapshots.value))
  const skillNames = computed(() => history.value.map((h) => h.skill))
  const total = computed(() => history.value.length)

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshots.value))
    } catch (err) {
      console.error('[skillTrack] 保存失败', err)
      throw err
    }
  }

  /** 追加一次自评快照（同技能多次记录形成轨迹） */
  function addSnapshot(payload: SkillSnapshotPayload): SkillSnapshot {
    const snap: SkillSnapshot = { id: uid('ss'), ...payload, level: Math.max(1, Math.min(5, payload.level)) }
    snapshots.value.push(snap)
    persist()
    return snap
  }

  function removeSnapshot(id: string): void {
    snapshots.value = snapshots.value.filter((s) => s.id !== id)
    persist()
  }

  function clearSkill(skill: string): void {
    snapshots.value = snapshots.value.filter((s) => s.skill !== skill)
    persist()
  }

  function clearAll(): void {
    snapshots.value = []
    persist()
  }

  return {
    snapshots,
    history,
    skillNames,
    total,
    addSnapshot,
    removeSnapshot,
    clearSkill,
    clearAll,
  }
})
