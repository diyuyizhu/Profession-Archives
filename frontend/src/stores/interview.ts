/**
 * 面试领域 store（模块 C）：面试轮次 + 复盘，localStorage 持久化。
 * C2 状态流转：记录一轮面试后按结果自动推进投递看板（通过→推进 / 淘汰→拒绝 / 待定→不动 / 终态→不动）。
 */
import type { Interview, InterviewPayload, Reflection, ReflectionPayload } from '@pa/shared'
import { INTERVIEW_RESULT_LABELS, INTERVIEW_TYPES } from '@pa/shared'
import { applyInterviewResult, nextRoundNumber } from '@pa/shared/interview'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'
import { useApplicationStore } from '@/stores/application'

const INTERVIEWS_KEY = 'pa-interviews-v1'
const REFLECTIONS_KEY = 'pa-reflections-v1'

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
    console.error(`[interview] 保存 ${key} 失败`, err)
    throw err
  }
}

/** 结构校验：坏数据宁可丢弃，避免模板访问 undefined 白屏（与 application store 同级） */
function sanitizeInterviews(list: unknown): Interview[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter(
      (i): i is Record<string, unknown> =>
        Boolean(i) && typeof i === 'object' && typeof i.id === 'string',
    )
    .filter((i) => {
      const t = i.interview_type
      const r = i.result
      return INTERVIEW_TYPES.includes(t as (typeof INTERVIEW_TYPES)[number]) &&
        INTERVIEW_RESULT_LABELS[r as keyof typeof INTERVIEW_RESULT_LABELS] !== undefined
    })
    .map((i) => ({
      id: i.id as string,
      application_id: typeof i.application_id === 'string' ? i.application_id : '',
      round: typeof i.round === 'number' ? i.round : 1,
      occurred_at: typeof i.occurred_at === 'string' ? i.occurred_at : ts.slice(0, 10),
      interview_type: i.interview_type as Interview['interview_type'],
      interviewer: typeof i.interviewer === 'string' ? i.interviewer : undefined,
      qa: Array.isArray(i.qa)
        ? i.qa.filter((q): q is Interview['qa'][number] => Boolean(q) && typeof q.question === 'string')
        : [],
      self_rating:
        typeof i.self_rating === 'number' ? Math.max(1, Math.min(5, Math.round(i.self_rating))) : 3,
      result: i.result as Interview['result'],
      notes: typeof i.notes === 'string' ? i.notes : undefined,
      created_at: typeof i.created_at === 'string' ? i.created_at : ts,
      updated_at: typeof i.updated_at === 'string' ? i.updated_at : ts,
    }))
}

/** 复盘结构校验 */
function sanitizeReflections(list: unknown): Reflection[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter(
      (r): r is Record<string, unknown> =>
        Boolean(r) && typeof r === 'object' && typeof r.id === 'string',
    )
    .map((r) => ({
      id: r.id as string,
      application_id: typeof r.application_id === 'string' ? r.application_id : '',
      interview_ids: Array.isArray(r.interview_ids)
        ? r.interview_ids.filter((x): x is string => typeof x === 'string')
        : [],
      highlights: Array.isArray(r.highlights)
        ? r.highlights.filter((x): x is string => typeof x === 'string')
        : [],
      improvements: Array.isArray(r.improvements)
        ? r.improvements.filter((x): x is string => typeof x === 'string')
        : [],
      next_strategy: Array.isArray(r.next_strategy)
        ? r.next_strategy.filter((x): x is string => typeof x === 'string')
        : [],
      content_md: typeof r.content_md === 'string' ? r.content_md : '',
      ai_generated: Boolean(r.ai_generated),
      created_at: typeof r.created_at === 'string' ? r.created_at : ts,
      updated_at: typeof r.updated_at === 'string' ? r.updated_at : ts,
    }))
}

export const useInterviewStore = defineStore('interview', () => {
  const interviews = ref<Interview[]>(sanitizeInterviews(load(INTERVIEWS_KEY)))
  const reflections = ref<Reflection[]>(sanitizeReflections(load(REFLECTIONS_KEY)))

  const total = computed(() => interviews.value.length)

  function persist(): void {
    save(INTERVIEWS_KEY, interviews.value)
    save(REFLECTIONS_KEY, reflections.value)
  }

  function interviewsOf(applicationId: string): Interview[] {
    return interviews.value
      .filter((i) => i.application_id === applicationId)
      .sort((a, b) => a.round - b.round)
  }

  /** 某投递下一轮的序号（与 recordInterview 同一口径：max(round)+1） */
  function nextRoundFor(applicationId: string): number {
    return nextRoundNumber(interviews.value, applicationId)
  }

  /**
   * 记录一轮面试：轮次自动编号；随后按结果执行 C2 状态流转。
   * 返回创建后的面试与投递是否发生了状态变更（newStatus 仅在变更发生时给出）。
   */
  function recordInterview(
    applicationId: string,
    payload: Omit<InterviewPayload, 'application_id'>,
  ): { interview: Interview; statusChanged: boolean; newStatus?: string } {
    const ts = new Date().toISOString()
    const round = nextRoundNumber(interviews.value, applicationId)
    const interview: Interview = {
      id: uid('iv'),
      application_id: applicationId,
      round,
      ...payload,
      created_at: ts,
      updated_at: ts,
    }
    interviews.value.push(interview)
    persist()

    // C2：按结果推进投递状态（终态投递不流转，由 applyInterviewResult 保证返回 null）
    const appStore = useApplicationStore()
    const app = appStore.applications.find((a) => a.id === applicationId)
    let statusChanged = false
    let newStatus: string | undefined
    if (app) {
      const target = applyInterviewResult(app.status, payload.result, app.total_rounds ?? 3)
      if (target && target !== app.status) {
        const note =
          payload.result === 'passed'
            ? `第 ${round} 轮面试通过，自动推进`
            : `第 ${round} 轮面试未通过`
        statusChanged = appStore.transition(app.id, target, note)
        if (statusChanged) newStatus = target
      }
    }
    return { interview, statusChanged, newStatus }
  }

  function updateInterview(id: string, patch: Partial<InterviewPayload>): void {
    const interview = interviews.value.find((i) => i.id === id)
    if (!interview) return
    const prevResult = interview.result
    Object.assign(interview, patch, { updated_at: new Date().toISOString() })
    persist()
    // C2：面试结果被编辑时，重新按新结果推进投递状态（保持看板与面试记录一致）
    if (patch.result && patch.result !== prevResult) {
      const appStore = useApplicationStore()
      const app = appStore.applications.find((a) => a.id === interview.application_id)
      if (app) {
        const target = applyInterviewResult(app.status, patch.result, app.total_rounds ?? 3)
        if (target && target !== app.status) {
          appStore.transition(app.id, target, `第 ${interview.round} 轮面试结果修正`)
        }
      }
    }
  }

  function removeInterview(id: string): void {
    interviews.value = interviews.value.filter((i) => i.id !== id)
    // 复盘若引用该面试，清掉引用（保留复盘正文）
    for (const ref of reflections.value) {
      if (ref.interview_ids.includes(id)) {
        ref.interview_ids = ref.interview_ids.filter((x) => x !== id)
      }
    }
    persist()
  }

  /** 删除某投递下的全部面试与复盘（投递被删时清理孤儿数据） */
  function removeByApplication(applicationId: string): void {
    interviews.value = interviews.value.filter((i) => i.application_id !== applicationId)
    reflections.value = reflections.value.filter((r) => r.application_id !== applicationId)
    persist()
  }

  /**
   * 保存复盘：同投递已有复盘则覆盖（去重，避免无限累积），否则新建。
   */
  function upsertReflection(payload: ReflectionPayload): Reflection {
    const ts = new Date().toISOString()
    const existing = reflections.value.find((r) => r.application_id === payload.application_id)
    if (existing) {
      Object.assign(existing, payload, { updated_at: ts })
      persist()
      return existing
    }
    const reflection: Reflection = { id: uid('rf'), ...payload, created_at: ts, updated_at: ts }
    reflections.value.push(reflection)
    persist()
    return reflection
  }

  function removeReflection(id: string): void {
    reflections.value = reflections.value.filter((r) => r.id !== id)
    persist()
  }

  function clearAll(): void {
    interviews.value = []
    reflections.value = []
    persist()
  }

  return {
    interviews,
    reflections,
    total,
    interviewsOf,
    nextRoundFor,
    recordInterview,
    updateInterview,
    removeInterview,
    removeByApplication,
    upsertReflection,
    removeReflection,
    clearAll,
  }
})
