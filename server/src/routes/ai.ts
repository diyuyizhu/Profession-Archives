/**
 * AI 服务接口（模块 E）：
 * - 读 ai_provider_config（云端 DeepSeek / 本地 Ollama）
 * - E3 隐私：云端调用前校验 dataExitConsented 授权 + 全局"仅本地模型"开关
 * - 调用 OpenAI 兼容接口（chat/completions），返回 { text, provider }
 */
import type { FastifyInstance } from 'fastify'

import { requirePairing } from '../plugins/auth.js'
import { callAi, getAiConfig, type AiCapability } from '../services/aiService.js'

const CAPABILITIES: AiCapability[] = ['extract', 'polish', 'match', 'reflect', 'learn']

interface AiBody {
  capability: AiCapability
  /** 能力对应的输入内容（字符串） */
  input: string
}

export function registerAiRoutes(app: FastifyInstance): void {
  // 各能力调用
  app.post<{ Params: { capability: string }; Body: AiBody }>(
    '/api/ai/:capability',
    { preHandler: requirePairing },
    async (request, reply) => {
      const capability = request.params.capability as AiCapability
      if (!CAPABILITIES.includes(capability)) {
        return reply.code(400).send({ error: `未知能力：${capability}（支持：${CAPABILITIES.join('/')}）` })
      }
      const input = request.body?.input
      if (typeof input !== 'string' || !input.trim()) {
        return reply.code(400).send({ error: '缺少 input（能力所需内容）' })
      }
      try {
        const result = await callAi(capability, input)
        return { ok: true, ...result }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // E3 未授权 / 未配置 → 4xx，其余 502
        if (/E3 未授权|未配置/.test(msg)) return reply.code(403).send({ error: msg })
        return reply.code(502).send({ error: msg })
      }
    },
  )

  // 读取 AI 配置（设置页同步用；Key 脱敏）
  app.get('/api/ai/config', { preHandler: requirePairing }, async () => {
    const cfg = getAiConfig()
    return {
      provider: cfg.provider,
      cloud_endpoint: cfg.cloud_endpoint,
      cloud_model: cfg.cloud_model,
      cloud_api_key_masked: cfg.cloud_api_key ? '••••' + cfg.cloud_api_key.slice(-4) : '',
      local_endpoint: cfg.local_endpoint,
      local_model: cfg.local_model,
      data_exit_consented: cfg.data_exit_consented === 1,
      local_only: cfg.local_only === 1,
    }
  })
}
