/**
 * 本地桥（127.0.0.1:8000）前端工具。
 * 桥在 Tauri 桌面版进程内运行；浏览器 dev 模式下桥不存在，调用静默失败。
 */

export const BRIDGE_BASE = 'http://127.0.0.1:8000'

/** fire-and-forget POST 到桥（桥离线静默失败，不阻塞调用方） */
export function postToBridge(path: string, body: unknown): void {
  void fetch(`${BRIDGE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    /* 桥离线（浏览器模式 / 未启动）—— 静默忽略 */
  })
}

/** 配对 token 缓存（先试桥 /api/bridge/pairing，再试 server /api/automation/pairing） */
let cachedToken: string | null = null

export async function fetchPairingToken(): Promise<string> {
  if (cachedToken) return cachedToken
  for (const path of ['/api/bridge/pairing', '/api/automation/pairing']) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 3000)
      const res = await fetch(`${BRIDGE_BASE}${path}`, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) {
        const data = (await res.json()) as { token?: string }
        if (data.token) {
          cachedToken = data.token
          return cachedToken
        }
      }
    } catch {
      /* 试下一个 */
    }
  }
  return ''
}

export function clearCachedToken(): void {
  cachedToken = null
}
