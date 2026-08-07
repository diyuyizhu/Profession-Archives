/**
 * 配对 token 认证（架构 §4.2）：
 * - 本地桥启动时生成唯一 token，桌面端设置页展示、插件 popup 粘贴
 * - 自动化 / 验证等敏感接口要求 `Authorization: Bearer <token>`
 * - 仅绑定 127.0.0.1 + CORS 白名单，双层防护
 */
import crypto from 'node:crypto'

// 开发/测试可用 PA_PAIRING_TOKEN 固定配对码；生产随机生成
let token = process.env.PA_PAIRING_TOKEN ?? crypto.randomUUID()

/** 当前配对 token（设置页展示用；TODO：接入 GET /api/automation/pairing 返回） */
export function getPairingToken(): string {
  return token
}

/** 重新生成（TODO：设置页"重置配对"调用） */
export function rotatePairingToken(): string {
  token = crypto.randomUUID()
  return token
}

/** Fastify preHandler：要求 Bearer token 匹配。token 匹配时调用 done 放行，否则 401 结束。 */
export function requirePairing(
  request: { headers: { authorization?: string } },
  reply: { code(code: number): { send(body: unknown): void } },
  done: () => void,
): void {
  const auth = request.headers.authorization
  if (auth !== `Bearer ${token}`) {
    reply.code(401).send({ error: '未配对：请先在桌面端复制配对码并在插件 popup 粘贴' })
    return
  }
  done()
}
