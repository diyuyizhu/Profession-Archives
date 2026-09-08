/**
 * 知识库 store（模块 K）：Markdown 文档 CRUD + 分组 + 标签 + 全文搜索。
 * localStorage 持久化（pa-knowledge-v1）。
 */
import type { KnowledgeDoc, KnowledgePayload } from '@pa/shared/knowledge'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-knowledge-v1'

function load(): KnowledgeDoc[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    const ts = new Date().toISOString()
    return list
      .filter(
        (d): d is Record<string, unknown> =>
          Boolean(d) && typeof d === 'object' && typeof (d as { title?: unknown }).title === 'string',
      )
      .map((d) => ({
        id: typeof d.id === 'string' ? d.id : uid('kd'),
        title: String(d.title ?? '未命名'),
        content_md: typeof d.content_md === 'string' ? d.content_md : '',
        tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [],
        group: typeof d.group === 'string' ? d.group : undefined,
        application_id: typeof d.application_id === 'string' ? d.application_id : undefined,
        created_at: typeof d.created_at === 'string' ? d.created_at : ts,
        updated_at: typeof d.updated_at === 'string' ? d.updated_at : ts,
      }))
  } catch {
    return []
  }
}

function persist(docs: KnowledgeDoc[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(docs))
  } catch (err) {
    console.error('[knowledge] 保存失败', err)
    throw err
  }
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  const docs = ref<KnowledgeDoc[]>(load())

  const total = computed(() => docs.value.length)

  function persistNow(): void {
    persist(docs.value)
  }

  function create(payload: KnowledgePayload): KnowledgeDoc {
    const ts = new Date().toISOString()
    const doc: KnowledgeDoc = { id: uid('kd'), ...payload, created_at: ts, updated_at: ts }
    docs.value.push(doc)
    persistNow()
    return doc
  }

  function update(id: string, patch: Partial<KnowledgePayload>): void {
    const doc = docs.value.find((d) => d.id === id)
    if (!doc) return
    Object.assign(doc, patch, { updated_at: new Date().toISOString() })
    persistNow()
  }

  function remove(id: string): void {
    docs.value = docs.value.filter((d) => d.id !== id)
    persistNow()
  }

  return { docs, total, create, update, remove }
})
