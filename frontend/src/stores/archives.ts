/**
 * 投递归档 store：每个投递一个"档案文件夹"—— 面试录制 / 附件 / 笔记。
 * 视频等大文件由用户下载保存到本地文件夹，这里记录元数据引用。
 * localStorage 持久化。
 */
import type { ArchiveItem, ArchivePayload } from '@pa/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-archives-v1'

function load(): ArchiveItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (a): a is ArchiveItem =>
          Boolean(a) && typeof a === 'object' && typeof a.id === 'string' && typeof a.application_id === 'string',
      )
      .map((a) => ({
        id: a.id,
        application_id: a.application_id,
        interview_id: typeof a.interview_id === 'string' ? a.interview_id : undefined,
        kind: ['recording', 'attachment', 'note'].includes(a.kind) ? a.kind : 'note',
        title: typeof a.title === 'string' ? a.title : '',
        file_name: typeof a.file_name === 'string' ? a.file_name : undefined,
        file_size: typeof a.file_size === 'number' ? a.file_size : undefined,
        duration: typeof a.duration === 'number' ? a.duration : undefined,
        occurred_at: typeof a.occurred_at === 'string' ? a.occurred_at : new Date().toISOString().slice(0, 10),
        created_at: typeof a.created_at === 'string' ? a.created_at : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

export const useArchivesStore = defineStore('archives', () => {
  const items = ref<ArchiveItem[]>(load())

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.value))
    } catch (err) {
      console.error('[archives] 保存失败', err)
      throw err
    }
  }

  function ofApplication(applicationId: string): ArchiveItem[] {
    return items.value
      .filter((a) => a.application_id === applicationId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }

  function addItem(payload: ArchivePayload): ArchiveItem {
    const item: ArchiveItem = { id: uid('ar'), ...payload, created_at: new Date().toISOString() }
    items.value.push(item)
    persist()
    return item
  }

  function removeItem(id: string): void {
    items.value = items.value.filter((a) => a.id !== id)
    persist()
  }

  function removeByApplication(applicationId: string): void {
    const before = items.value.length
    items.value = items.value.filter((a) => a.application_id !== applicationId)
    if (items.value.length !== before) persist()
  }

  function clearAll(): void {
    items.value = []
    persist()
  }

  return { items, ofApplication, addItem, removeItem, removeByApplication, clearAll }
})
