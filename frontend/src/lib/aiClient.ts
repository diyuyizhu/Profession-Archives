/**
 * 前端 AI 客户端：通过本地桥（127.0.0.1:8000）调用 AI 能力。
 * 统一走 bridgeRequest：自动注入 Bearer token，401（token 轮换）时已内置清缓存重试。
 */
import { bridgeRequest } from '@/lib/bridge'

/** 调用桥 AI 端点（鉴权 / 401 重试由 bridgeRequest 内置） */
async function callAi<T>(path: string, payload: unknown): Promise<T> {
  return bridgeRequest<T>(path, { method: 'POST', body: JSON.stringify(payload) })
}

/** 生成特化简历：传 JD + 档案文本 */
export async function generateResume(jd: string, profileText: string): Promise<string> {
  const data = await callAi<{ text: string }>('/api/automation/ai/generate-resume', {
    jd,
    profile: profileText,
  })
  return data.text
}

/** 解析简历文本为结构化档案 */
export interface ParsedResume {
  full_name?: string
  email?: string
  phone?: string
  headline?: string
  summary?: string
  skills?: Array<{ name: string; category?: string; level?: number }>
  experiences?: Array<{ role: string; company?: string; description_md?: string; start_date?: string; end_date?: string }>
  education?: Array<{ school: string; degree?: string; major?: string; start_date?: string; end_date?: string }>
  projects?: Array<{ name: string; summary?: string; description_md?: string }>
}

export async function parseResume(text: string): Promise<ParsedResume> {
  const data = await callAi<{ parsed: ParsedResume }>('/api/automation/ai/parse-resume', { text })
  return data.parsed ?? {}
}

/** 表单字段 AI 识别 */
export async function analyzeFields(fields: unknown[]): Promise<Array<{ key: string; target: string }>> {
  const data = await callAi<{ mappings: Array<{ key: string; target: string }> }>(
    '/api/automation/ai/analyze-fields',
    { fields },
  )
  return data.mappings ?? []
}

/** 岗位 AI 提取 */
export async function extractJob(text: string): Promise<Record<string, unknown>> {
  const data = await callAi<{ job: Record<string, unknown> }>('/api/automation/ai/extract-job', { text })
  return data.job ?? {}
}
