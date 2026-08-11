/**
 * 看板呈现偏好 store：视图（看板/列表）、列内排序、卡片显示字段，localStorage 持久化。
 * 对应需求：看板具备筛选/排序/标签分类，具体呈现方式可由设置选择。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'pa-board-prefs-v1'

export type BoardViewMode = 'board' | 'list' | 'pipeline'
export type BoardSortMode = 'updated' | 'applied' | 'importance' | 'title'
export type BoardFieldKey = 'channel' | 'date' | 'tags' | 'notes' | 'importance'

export interface BoardPrefs {
  viewMode: BoardViewMode
  sortMode: BoardSortMode
  showFields: Record<BoardFieldKey, boolean>
}

const DEFAULT_PREFS: BoardPrefs = {
  viewMode: 'board',
  sortMode: 'updated',
  showFields: { channel: true, date: true, tags: true, notes: true, importance: true },
}

export const FIELD_LABELS: Record<BoardFieldKey, string> = {
  channel: '渠道',
  date: '投递日期',
  tags: '标签',
  notes: '备注',
  importance: '重要性',
}

function load(): BoardPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<BoardPrefs>
    const showFields = { ...DEFAULT_PREFS.showFields }
    if (parsed.showFields && typeof parsed.showFields === 'object') {
      for (const key of Object.keys(DEFAULT_PREFS.showFields) as BoardFieldKey[]) {
        if (typeof parsed.showFields[key] === 'boolean') showFields[key] = parsed.showFields[key]!
      }
    }
    return {
      viewMode:
        parsed.viewMode === 'list' || parsed.viewMode === 'pipeline' ? parsed.viewMode : 'board',
      sortMode:
        parsed.sortMode === 'applied' || parsed.sortMode === 'importance' || parsed.sortMode === 'title'
          ? parsed.sortMode
          : 'updated',
      showFields,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export const useBoardPrefsStore = defineStore('boardPrefs', () => {
  const prefs = ref<BoardPrefs>(load())

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs.value))
    } catch (err) {
      console.error('[boardPrefs] 保存失败', err)
      throw err
    }
  }

  function set(patch: Partial<BoardPrefs>): void {
    Object.assign(prefs.value, patch)
    persist()
  }

  function setField(key: BoardFieldKey, on: boolean): void {
    prefs.value.showFields[key] = on
    persist()
  }

  function reset(): void {
    prefs.value = { ...DEFAULT_PREFS }
    persist()
  }

  return { prefs, set, setField, reset }
})
