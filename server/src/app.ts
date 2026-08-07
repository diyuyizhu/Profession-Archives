/**
 * Fastify app 工厂：注册插件与档案领域路由（模块 A）。
 * 骨架路由：AI 服务（/api/ai）、可信认证（/api/verify）、插件本地桥（/api/automation）。
 */
import cors from '@fastify/cors'
import Fastify from 'fastify'

import { initSchema } from './db.js'
import { getProfile, listProfiles, upsertProfile } from './profile.js'
import { registerAiRoutes } from './routes/ai.js'
import { registerAutomationRoutes } from './routes/automation.js'
import { registerVerifyRoutes } from './routes/verify.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  // CORS 白名单：仅放行本地开发前端（localhost/127.0.0.1 任意端口）、
  // Tauri webview（tauri://）与本机 file:// 页面（origin 为 "null"，供本地测试页联调）。
  // 不放行任意 Origin —— 否则任意网页 JS 都能 fetch 本机服务读取档案 PII。
  // 配对 token（D 模块）在自动化接口接入。
  void app.register(cors, {
    origin: (origin, cb) => {
      const allow =
        !origin ||
        origin === 'null' ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^tauri:\/\//.test(origin) ||
        /^https?:\/\/tauri\.localhost/.test(origin)
      cb(null, allow)
    },
  })

  app.get('/health', async () => ({ status: 'ok' }))

  // ── 档案领域（模块 A）──
  app.post('/api/profiles', async (request, reply) => {
    const payload = request.body as Record<string, unknown> | null
    // 请求体校验：避免畸形 payload 触发 500 / SQLite 约束错误
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return reply.code(400).send({ error: '请求体必须是对象' })
    }
    if (typeof payload.full_name !== 'string' || !payload.full_name.trim()) {
      return reply.code(400).send({ error: 'full_name 必填（字符串）' })
    }
    for (const k of ['skills', 'experiences', 'education', 'projects', 'journal']) {
      if (payload[k] !== undefined && !Array.isArray(payload[k])) {
        return reply.code(400).send({ error: `${k} 必须是数组` })
      }
    }
    return upsertProfile(payload as Parameters<typeof upsertProfile>[0])
  })

  app.get('/api/profiles', async () => listProfiles())

  app.get('/api/profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const profile = getProfile(id)
    if (!profile) return reply.code(404).send({ error: 'Profile not found' })
    return profile
  })

  // ── 骨架路由：AI 服务 / 可信认证 / 插件本地桥 ──
  registerAiRoutes(app)
  registerVerifyRoutes(app)
  registerAutomationRoutes(app)

  return app
}

/** 启动入口（dev：tsx watch；生产：sidecar spawn） */
export async function start(port = 8000): Promise<string> {
  initSchema()
  const app = buildApp()
  await app.listen({ port, host: '127.0.0.1' })
  return `http://127.0.0.1:${port}`
}
