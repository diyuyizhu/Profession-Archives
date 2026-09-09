/**
 * 本地桥（127.0.0.1:8000）前端工具。
 * 桥在 Tauri 桌面版进程内运行；浏览器 dev 模式下桥不存在，调用静默失败。
 *
 * 安全模型（桌面端加固后）：
 * - GET /api/bridge/token：发 token 的端点本身，无需 Bearer，但校验 Origin 白名单
 *   （仅本机回环来源，防远程网页窃取 token）
 * - 其余端点（/api/bridge/sync、/api/bridge/inbox、/api/automation/ai/* 等）必须带
 *   Authorization: Bearer <token>，统一由 bridgeRequest 注入
 * - BRIDGE_BASE 固定 127.0.0.1 回环（webview 场景），防 DNS 重绑定
 */

export const BRIDGE_BASE = 'http://127.0.0.1:8000'

/** 桥请求错误：携带 HTTP 状态码，供 401 自动重试等调用方按状态判断 */
export class BridgeRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'BridgeRequestError'
    this.status = status
  }
}

/** 配对 token 缓存（仅从 GET /api/bridge/token 获取，不再回退 server /api/automation/pairing） */
let cachedToken: string | null = null

/**
 * 获取配对 token（3 秒超时；失败返回 ''）。
 * 用途：AutomationPluginView 展示配对码；bridgeRequest 内部取 token 注入鉴权头。
 */
export async function fetchPairingToken(): Promise<string> {
  if (cachedToken) return cachedToken
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${BRIDGE_BASE}/api/bridge/token`, { signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) {
      const data = (await res.json()) as { token?: string }
      if (data.token) {
        cachedToken = data.token
        return cachedToken
      }
    }
  } catch {
    /* 桥离线（浏览器模式 / 未启动 / Origin 不在白名单）——返回 '' */
  }
  return ''
}

export function clearCachedToken(): void {
  cachedToken = null
}

/**
 * 调用桥端点：自动获取并注入 Bearer token 与 Content-Type: application/json。
 * 401（token 轮换 / 桥重建）时清缓存换新 token 重试一次；
 * 非 ok 或 body 含 error 字段时 throw BridgeRequestError（message 取 body.error 或 HTTP 状态码）。
 * init.body 遵循 fetch 语义，JSON 载荷请自行 stringify。
 */
export async function bridgeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const attempt = async (token: string): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
    if (init?.headers) Object.assign(headers, init.headers as Record<string, string>)
    const res = await fetch(`${BRIDGE_BASE}${path}`, { ...init, headers })
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      /* body 为空或非 JSON：仅按状态码报错 */
    }
    const record =
      data && typeof data === 'object' && !Array.isArray(data) ? (data as { error?: string }) : {}
    if (!res.ok || record.error) {
      throw new BridgeRequestError(record.error ?? `桥返回错误: HTTP ${res.status}`, res.status)
    }
    return data as T
  }

  let token = await fetchPairingToken()
  if (!token) throw new Error('本地桥未运行（请启动桌面应用）')
  try {
    return await attempt(token)
  } catch (e) {
    // token 可能已轮换（桥重建）：清缓存换新 token 重试一次
    if (e instanceof BridgeRequestError && e.status === 401) {
      clearCachedToken()
      token = await fetchPairingToken()
      if (token) return await attempt(token)
    }
    throw e
  }
}

/** fire-and-forget POST 到桥（走 bridgeRequest 自动带 token；桥离线静默失败，不阻塞调用方） */
export function postToBridge(path: string, body: unknown): void {
  void bridgeRequest(path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {
    /* 桥离线 / token 不可用 —— 静默忽略 */
  })
}
