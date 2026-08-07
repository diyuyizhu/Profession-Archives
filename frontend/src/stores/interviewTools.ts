/**
 * 面试工具 store：可自定义的面试软件列表（腾讯会议/飞书/Zoom/线下…），
 * 面试前选择，录制后归档到投递档案。localStorage 持久化。
 */
import type { InterviewTool, InterviewToolKind } from '@pa/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-interview-tools-v1'

function load(): InterviewTool[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (t): t is InterviewTool =>
          Boolean(t) && typeof t === 'object' && typeof t.name === 'string',
      )
      .map((t) => ({
        id: typeof t.id === 'string' ? t.id : uid('it'),
        name: t.name,
        kind: ['video', 'onsite', 'phone', 'other'].includes(t.kind) ? t.kind : 'other',
        url: typeof t.url === 'string' ? t.url : undefined,
      }))
  } catch {
    return []
  }
}

export const useInterviewToolsStore = defineStore('interviewTools', () => {
  const tools = ref<InterviewTool[]>(load())

  const TOOL_KIND_LABEL: Record<InterviewToolKind, string> = {
    video: '线上会议',
    onsite: '线下',
    phone: '电话',
    other: '其他',
  }

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(tools.value))
    } catch (err) {
      console.error('[interviewTools] 保存失败', err)
      throw err
    }
  }

  function addTool(name: string, kind: InterviewToolKind, url?: string): InterviewTool {
    const t: InterviewTool = { id: uid('it'), name: name.trim(), kind, url: url?.trim() || undefined }
    tools.value.push(t)
    persist()
    return t
  }

  function removeTool(id: string): void {
    tools.value = tools.value.filter((t) => t.id !== id)
    persist()
  }

  return { tools, TOOL_KIND_LABEL, addTool, removeTool }
})
