/**
 * AI 服务（模块 E）：读 ai_provider_config → 调用 OpenAI 兼容接口（DeepSeek / Ollama）。
 * E3 隐私：云端调用前校验 dataExitConsented 授权 + 全局"仅本地模型"开关。
 */
import { db } from '../db.js'

export type AiCapability = 'extract' | 'polish' | 'match' | 'reflect' | 'learn'

export interface AiConfigRow {
  provider: 'cloud' | 'local'
  cloud_endpoint: string
  cloud_model: string
  cloud_api_key: string
  local_endpoint: string
  local_model: string
  data_exit_consented: number
  local_only: number
}

/** 读取 AI 配置（表无记录时返回默认） */
export function getAiConfig(): AiConfigRow {
  const row = db.prepare('SELECT * FROM ai_provider_config WHERE id = 1').get() as
    | AiConfigRow
    | undefined
  if (row) return row
  const def: AiConfigRow = {
    provider: 'cloud',
    cloud_endpoint: 'https://api.deepseek.com',
    cloud_model: 'deepseek-chat',
    cloud_api_key: '',
    local_endpoint: 'http://localhost:11434/v1',
    local_model: 'qwen2.5:7b',
    data_exit_consented: 0,
    local_only: 0,
  }
  return def
}

/** 保存 AI 配置（骨架：由设置接口调用） */
export function upsertAiConfig(cfg: Partial<AiConfigRow>): AiConfigRow {
  const cur = getAiConfig()
  const next = { ...cur, ...cfg }
  db.prepare(
    `INSERT INTO ai_provider_config
       (id, provider, cloud_endpoint, cloud_model, cloud_api_key, local_endpoint, local_model, data_exit_consented, local_only)
     VALUES (1, @provider, @cloud_endpoint, @cloud_model, @cloud_api_key, @local_endpoint, @local_model, @data_exit_consented, @local_only)
     ON CONFLICT(id) DO UPDATE SET
       provider=@provider, cloud_endpoint=@cloud_endpoint, cloud_model=@cloud_model,
       cloud_api_key=@cloud_api_key, local_endpoint=@local_endpoint, local_model=@local_model,
       data_exit_consented=@data_exit_consented, local_only=@local_only`,
  ).run(next)
  return next
}

/** 各能力对应的 prompt 模板（统一 system 指令 + 用户内容） */
const PROMPTS: Record<AiCapability, string> = {
  extract: '你是职业档案助手。把下面零散的日记/记录提炼为 2-4 条简历可用的结构化亮点（中文，每条一句话）。',
  polish: '你是简历润色专家。对下面的简历正文逐段优化措辞、强化关键词，输出润色后的文本与建议。',
  match: '你是招聘匹配分析师。分析下面简历与 JD 的匹配度，输出匹配分、已覆盖/缺口关键词与定制个人简介建议。',
  reflect: '你是面试复盘教练。基于下面的面试记录，输出：做得好 / 待改进 / 下次策略 三部分要点（中文）。',
  learn: '你是成长规划师。基于下面的短板与复盘，输出一份可执行的学习计划（3-6 个任务，含优先级）。',
}

/**
 * Endpoint 安全校验（SSRF / API Key 泄漏防护）：
 * - 云端只允许 https 且不得指向本机/内网/链路本地（防止把 Key 发给恶意 host 或探测内网）
 * - 本地 Ollama 只允许指向本机
 */
function assertSafeEndpoint(endpoint: string, isCloud: boolean): void {
  let u: URL
  try {
    u = new URL(endpoint)
  } catch {
    throw new Error('Endpoint 不是合法 URL')
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isCloud) {
    if (u.protocol !== 'https:') throw new Error('云端 Endpoint 必须使用 https')
    const unsafe =
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^0\./.test(host) ||
      /^fe80:/.test(host) ||
      /^fd/.test(host) ||
      host === 'metadata.google.internal'
    if (unsafe) throw new Error('云端 Endpoint 不允许指向本机/内网/链路本地地址')
  } else if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error('本地 Endpoint 只能指向本机（localhost / 127.0.0.1）')
  }
}

/** 调用 OpenAI 兼容接口（DeepSeek / Ollama 均支持），带 15s 超时 */
export async function callAi(
  capability: AiCapability,
  input: string,
): Promise<{ text: string; provider: 'cloud' | 'local' }> {
  const cfg = getAiConfig()

  // E3：云端需要授权；localOnly 强制本地
  const useCloud = cfg.local_only === 1 ? false : cfg.provider === 'cloud'
  if (useCloud && cfg.data_exit_consented !== 1) {
    throw new Error('E3 未授权：云端 AI 调用需先在设置中授权数据出境')
  }

  const endpoint = useCloud ? cfg.cloud_endpoint : cfg.local_endpoint
  const model = useCloud ? cfg.cloud_model : cfg.local_model
  const apiKey = useCloud ? cfg.cloud_api_key : ''
  if (!endpoint || !model) throw new Error('AI 未配置：请在设置页填写 Endpoint 与模型名')
  if (useCloud && !apiKey) throw new Error('云端 AI 未配置 API Key')
  assertSafeEndpoint(endpoint, useCloud)

  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (useCloud) headers.Authorization = `Bearer ${apiKey}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PROMPTS[capability] },
          { role: 'user', content: input },
        ],
        temperature: 0.6,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`AI 调用失败：${res.status} ${await res.text().catch(() => '')}`.slice(0, 300))
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) throw new Error('AI 返回为空')
    return { text, provider: useCloud ? 'cloud' : 'local' }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI 调用超时（15s）')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
