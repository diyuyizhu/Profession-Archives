/**
 * 学习计划 store（模块 F2）：计划 + 任务 CRUD，localStorage 持久化。
 */
import type { LearningPlan, LearningPlanPayload } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-learning-plans-v1'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 结构校验：坏数据宁可丢弃，避免模板访问 undefined 白屏 */
function sanitize(list: unknown): LearningPlan[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter(
      (p): p is Record<string, unknown> =>
        Boolean(p) && typeof p === 'object' && typeof p.title === 'string',
    )
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : uid('lp'),
      title: p.title as string,
      description: typeof p.description === 'string' ? p.description : undefined,
      source: p.source === 'reflection' ? 'reflection' : 'manual',
      tasks: Array.isArray(p.tasks)
        ? (p.tasks as Array<Record<string, unknown>>)
            .filter((t) => Boolean(t) && typeof t === 'object')
            .map((t) => ({
              id: typeof t.id === 'string' ? t.id : uid('lt'),
              title: typeof t.title === 'string' ? t.title : '',
              done: Boolean(t.done),
              due: typeof t.due === 'string' ? t.due : undefined,
            }))
            .filter((t) => t.title)
        : [],
      created_at: typeof p.created_at === 'string' ? p.created_at : ts,
      updated_at: typeof p.updated_at === 'string' ? p.updated_at : ts,
    }))
}

export const useLearningStore = defineStore('learning', () => {
  const plans = ref<LearningPlan[]>(sanitize(load(KEY)))

  const total = computed(() => plans.value.length)
  const activePlans = computed(() =>
    [...plans.value]
      .filter((p) => p.tasks.some((t) => !t.done))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
  )

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(plans.value))
    } catch (err) {
      console.error('[learning] 保存失败', err)
      throw err
    }
  }

  function addPlan(payload: LearningPlanPayload): LearningPlan {
    const ts = new Date().toISOString()
    const plan: LearningPlan = {
      id: uid('lp'),
      ...payload,
      tasks: payload.tasks.map((t) => ({ ...t, id: t.id || uid('lt') })),
      created_at: ts,
      updated_at: ts,
    }
    plans.value.push(plan)
    persist()
    return plan
  }

  function updatePlan(id: string, patch: Partial<LearningPlanPayload>): void {
    const plan = plans.value.find((p) => p.id === id)
    if (!plan) return
    if (patch.title !== undefined) plan.title = patch.title
    if (patch.description !== undefined) plan.description = patch.description
    plan.updated_at = new Date().toISOString()
    persist()
  }

  function removePlan(id: string): void {
    plans.value = plans.value.filter((p) => p.id !== id)
    persist()
  }

  /** 切换任务完成状态 */
  function toggleTask(planId: string, taskId: string): void {
    const plan = plans.value.find((p) => p.id === planId)
    const task = plan?.tasks.find((t) => t.id === taskId)
    if (!plan || !task) return
    task.done = !task.done
    plan.updated_at = new Date().toISOString()
    persist()
  }

  /** 追加任务 */
  function addTask(planId: string, title: string): void {
    const plan = plans.value.find((p) => p.id === planId)
    if (!plan || !title.trim()) return
    plan.tasks.push({ id: uid('lt'), title: title.trim(), done: false })
    plan.updated_at = new Date().toISOString()
    persist()
  }

  function removeTask(planId: string, taskId: string): void {
    const plan = plans.value.find((p) => p.id === planId)
    if (!plan) return
    plan.tasks = plan.tasks.filter((t) => t.id !== taskId)
    plan.updated_at = new Date().toISOString()
    persist()
  }

  function clearAll(): void {
    plans.value = []
    persist()
  }

  return {
    plans,
    total,
    activePlans,
    addPlan,
    updatePlan,
    removePlan,
    toggleTask,
    addTask,
    removeTask,
    clearAll,
  }
})
