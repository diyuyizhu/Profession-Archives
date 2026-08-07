/**
 * 面经题库 store（模块 C4）：题目 CRUD + 关键词/分类筛选，localStorage 持久化。
 * 来源：面试沉淀（C4 自动入库）/ 手动录入。结构校验同 application store 模式。
 */
import type { QuestionBankItem, QuestionBankPayload } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-question-bank-v1'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 结构校验：坏数据宁可丢弃，避免模板访问 undefined 白屏 */
function sanitize(list: unknown): QuestionBankItem[] {
  if (!Array.isArray(list)) return []
  const ts = new Date().toISOString()
  return list
    .filter(
      (q): q is Record<string, unknown> =>
        Boolean(q) && typeof q === 'object' && typeof q.question === 'string',
    )
    .map((q) => ({
      id: typeof q.id === 'string' ? q.id : uid('qb'),
      question: q.question as string,
      answer: typeof q.answer === 'string' ? q.answer : undefined,
      category: typeof q.category === 'string' ? q.category : undefined,
      industry: typeof q.industry === 'string' ? q.industry : undefined,
      difficulty:
        typeof q.difficulty === 'number' ? Math.max(1, Math.min(5, q.difficulty)) : 2,
      tags: Array.isArray(q.tags) ? q.tags.filter((t): t is string => typeof t === 'string') : [],
      source: q.source === 'manual' ? 'manual' : 'interview',
      interview_id: typeof q.interview_id === 'string' ? q.interview_id : undefined,
      created_at: typeof q.created_at === 'string' ? q.created_at : ts,
      updated_at: typeof q.updated_at === 'string' ? q.updated_at : ts,
    }))
}

export const useQuestionBankStore = defineStore('questionBank', () => {
  const items = ref<QuestionBankItem[]>(sanitize(load(KEY)))

  const total = computed(() => items.value.length)

  /** 全部可选分类（按出现次数倒序） */
  const categories = computed(() => {
    const map = new Map<string, number>()
    for (const item of items.value) {
      const c = item.category?.trim() || '未分类'
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
  })

  /** 全部标签（去重，按出现次数倒序） */
  const tags = computed(() => {
    const map = new Map<string, number>()
    for (const item of items.value) {
      for (const t of item.tags) {
        map.set(t, (map.get(t) ?? 0) + 1)
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
  })

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.value))
    } catch (err) {
      console.error('[questionBank] 保存失败', err)
      throw err
    }
  }

  function addItem(payload: QuestionBankPayload): QuestionBankItem {
    const ts = new Date().toISOString()
    // 写入路径与 sanitize 一致地 clamp difficulty
    const item: QuestionBankItem = {
      id: uid('qb'),
      ...payload,
      difficulty: Math.max(1, Math.min(5, Math.round(payload.difficulty))),
      created_at: ts,
      updated_at: ts,
    }
    items.value.push(item)
    persist()
    return item
  }

  function updateItem(id: string, patch: Partial<QuestionBankPayload>): void {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    if (typeof patch.difficulty === 'number') {
      patch.difficulty = Math.max(1, Math.min(5, Math.round(patch.difficulty)))
    }
    Object.assign(item, patch, { updated_at: new Date().toISOString() })
    persist()
  }

  function removeItem(id: string): void {
    items.value = items.value.filter((i) => i.id !== id)
    persist()
  }

  /** 删除引用某面试的题库条目（投递/面试被删时清理悬空引用） */
  function removeByInterviewId(interviewId: string): void {
    const before = items.value.length
    items.value = items.value.filter((i) => i.interview_id !== interviewId)
    if (items.value.length !== before) persist()
  }

  function clearAll(): void {
    items.value = []
    persist()
  }

  return {
    items,
    total,
    categories,
    tags,
    addItem,
    updateItem,
    removeItem,
    removeByInterviewId,
    clearAll,
  }
})
