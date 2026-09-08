/**
 * 插件 AI 端点（模块 D）：analyze-fields / extract-job / generate-resume / parse-resume。
 * 全部走配对 token 鉴权；AI 调用失败时本地启发式兜底（fallback: true）。
 */
import type { FastifyInstance } from 'fastify'

import { requirePairing, getPairingToken } from '../plugins/auth.js'
import { callAi } from '../services/aiService.js'

/* ── 字段识别启发式兜底（与 content.ts FIELD_RULES 保持同源） ── */
const FIELD_RULES: Array<[RegExp, string]> = [
  [/fullname|full_name|realname|your.?name|user.?name/i, 'full_name'],
  [/^email|mail/i, 'email'],
  [/phone|mobile|tel/i, 'phone'],
  [/headline|job.?title|position/i, 'headline'],
  [/summary|bio|intro|about/i, 'summary'],
]

interface FieldInfo {
  index: number
  name: string
  id: string
  label: string
}

function heuristicFieldMapping(fields: FieldInfo[]): Array<{ key: string; target: string }> {
  return fields.map((f) => {
    const combined = `${f.name} ${f.id} ${f.label}`.toLowerCase()
    let target = 'other'
    for (const [re, key] of FIELD_RULES) {
      if (re.test(combined)) {
        target = key
        break
      }
    }
    return { key: String(f.index), target }
  })
}

/** 从纯文本中提取招聘信息兜底 */
function heuristicExtractJob(text: string): { company: string; title: string; jd: string } {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const title = lines[0]?.slice(0, 60) ?? ''
  const companyMatch = text.match(/([^，。,;；\s]{2,20}?(?:公司|集团|科技|网络|软件|数据|实验室|工作室))/i)
  const company = companyMatch?.[1]?.trim() ?? ''
  const jd = lines.slice(0, 50).join('\n').slice(0, 3000)
  return { company, title, jd }
}

/** JSON 提取容错：AI 返回文本中提取 JSON（直接解析 → 尾部块 → ```json 代码块） */
function parseJsonFromAi(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    /* ignore */
  }
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1]!)
    } catch {
      /* ignore */
    }
  }
  const obj = text.match(/\{[\s\S]*\}/)
  if (obj) {
    try {
      return JSON.parse(obj[0])
    } catch {
      /* ignore */
    }
  }
  const arr = text.match(/\[[\s\S]*\]/)
  if (arr) {
    try {
      return JSON.parse(arr[0])
    } catch {
      /* ignore */
    }
  }
  return null
}

export function registerAutomationAiRoutes(app: FastifyInstance): void {
  /** POST /api/automation/ai/analyze-fields — AI 识别表单字段 → 档案字段映射 */
  app.post('/api/automation/ai/analyze-fields', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { fields?: FieldInfo[] }
    const fields = body.fields
    if (!Array.isArray(fields) || !fields.length) {
      return reply.code(400).send({ error: '需提供 fields 数组' })
    }
    try {
      const result = await callAi('analyze_fields', JSON.stringify(fields))
      const parsed = parseJsonFromAi(result.text)
      if (Array.isArray(parsed)) {
        return { ok: true, mappings: parsed.filter((m) => m && typeof m === 'object' && 'key' in m && 'target' in m) }
      }
      return { ok: true, mappings: heuristicFieldMapping(fields), fallback: true }
    } catch {
      return { ok: true, mappings: heuristicFieldMapping(fields), fallback: true }
    }
  })

  /** POST /api/automation/ai/extract-job — AI 从页面文本提取岗位信息 */
  app.post('/api/automation/ai/extract-job', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { text?: string }
    const text = typeof body.text === 'string' ? body.text : ''
    if (!text.trim()) return reply.code(400).send({ error: '需提供 text（页面文本）' })
    try {
      const result = await callAi('extract_job', text.slice(0, 8000))
      const parsed = parseJsonFromAi(result.text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>
        return {
          ok: true,
          job: {
            company: typeof p.company === 'string' ? p.company : '',
            title: typeof p.title === 'string' ? p.title : '',
            jd: typeof p.jd === 'string' ? p.jd : '',
          },
        }
      }
      return { ok: true, job: heuristicExtractJob(text), fallback: true }
    } catch {
      return { ok: true, job: heuristicExtractJob(text), fallback: true }
    }
  })

  /** POST /api/automation/ai/parse-resume — AI 解析简历文本为结构化档案 */
  app.post('/api/automation/ai/parse-resume', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { text?: string }
    const text = typeof body.text === 'string' ? body.text : ''
    if (!text.trim()) return reply.code(400).send({ error: '需提供 text（简历正文）' })
    try {
      const result = await callAi('parse_resume', text.slice(0, 15000))
      const parsed = parseJsonFromAi(result.text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ok: true, parsed }
      }
      return { ok: true, parsed: {}, fallback: true }
    } catch {
      return { ok: true, parsed: {}, fallback: true }
    }
  })

  /** POST /api/automation/ai/generate-resume — AI 生成特化简历（Markdown） */
  app.post('/api/automation/ai/generate-resume', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { jd?: string; profile?: string }
    const jd = typeof body.jd === 'string' ? body.jd : ''
    const profileText = typeof body.profile === 'string' ? body.profile : ''
    if (!jd.trim() || !profileText.trim()) {
      return reply.code(400).send({ error: '需提供 jd 与 profile' })
    }
    try {
      const input = `目标 JD：\n${jd.slice(0, 5000)}\n\n个人档案材料：\n${profileText.slice(0, 8000)}`
      const result = await callAi('generate_resume', input)
      return { ok: true, text: result.text }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/E3 未授权|未配置/.test(msg)) return reply.code(403).send({ error: msg })
      return reply.code(502).send({ error: `AI 生成失败：${msg}` })
    }
  })

  /** GET /api/automation/pairing — 读取当前配对 token（无需认证，仅本机可达） */
  app.get('/api/automation/pairing', async () => ({
    ok: true,
    token: getPairingToken(),
  }))
}
