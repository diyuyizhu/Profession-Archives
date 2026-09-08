/**
 * 前端 AI 客户端：通过本地桥（127.0.0.1:8000）调用 AI 能力。
 * 桥要求配对 token，这里自动从桥获取（先试 /api/bridge/pairing，再试 server /api/automation/pairing）。
 */
import { BRIDGE_BASE, fetchPairingToken, clearCachedToken } from '@/lib/bridge'

/** 发起一次 AI 请求 */
async function postAi<T>(path: string, payload: unknown, token: string): Promise<T> {
  const res = await fetch(`${BRIDGE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  let data: { ok?: boolean; error?: string } & T
  try {
    data = (await res.json()) as { ok?: boolean; error?: string } & T
  } catch {
    throw new Error(`桥返回错误: HTTP ${res.status}`)
  }
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `桥返回错误: HTTP ${res.status}`)
  }
  return data
}

/** 调用桥 AI 端点（401 时清缓存 token 重试一次） */
async function callAi<T>(path: string, payload: unknown): Promise<T> {
  let token = await fetchPairingToken()
  if (!token) throw new Error('本地桥未运行（请启动桌面应用）')
  try {
    return await postAi<T>(path, payload, token)
  } catch (e) {
    // token 可能已轮换（桥重建）：清缓存重试一次
    if (e instanceof Error && e.message.includes('401')) {
      clearCachedToken()
      token = await fetchPairingToken()
      if (token) return await postAi<T>(path, payload, token)
    }
    throw e
  }
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
