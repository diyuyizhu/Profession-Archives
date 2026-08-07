/**
 * background service worker：消息路由 + 本地桥（127.0.0.1）调用骨架。
 *
 * TODO（服务端落地后实现）：
 * - 配对：popup 粘贴配对码存 chrome.storage.local，请求带 Authorization: Bearer <token>
 * - 本地桥端点（见 server/src/app.ts）：
 *     GET  /api/automation/profile   读取当前档案（供填充）
 *     POST /api/automation/job       采集岗位回传
 *     POST /api/automation/application 投递结果回传
 *     POST/GET /api/automation/form-mapping 站点字段映射记忆
 */
export default defineBackground(() => {
  const LOCAL_BRIDGE = 'http://127.0.0.1:8000'

  async function bridge(path: string, init?: RequestInit): Promise<unknown> {
    const { pairingCode } = await chrome.storage.local.get('pairingCode')
    const res = await fetch(`${LOCAL_BRIDGE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(pairingCode ? { Authorization: `Bearer ${pairingCode}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) throw new Error(`本地桥请求失败：${res.status}`)
    return res.json()
  }

  /**
   * 桌面采集（录系统声音）：chrome.desktopCapture 只能由扩展调用。
   * 返回 streamId 给 content script，content 用 getUserMedia({ chromeMediaSource: 'desktop' }) 取系统音频。
   */
  function captureDesktop(withAudio: boolean, targetTabId?: number): Promise<string | null> {
    return new Promise((resolve) => {
      const types: Array<'screen' | 'audio' | 'tab'> = withAudio ? ['screen', 'audio'] : ['screen']
      const getStreamId = targetTabId
        ? (cb: (id: string) => void) => chrome.desktopCapture.chooseDesktopMedia(types, targetTabId, (id) => cb(id))
        : (cb: (id: string) => void) => chrome.desktopCapture.chooseDesktopMedia(types, (id) => cb(id))
      getStreamId((streamId) => resolve(streamId || null))
    })
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message?.type) {
      case 'GET_PROFILE':
        bridge('/api/automation/profile').then(sendResponse).catch((e) => sendResponse({ error: String(e) }))
        return true
      case 'COLLECT_JOB':
        bridge('/api/automation/job', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // 录系统声音：返回 desktopCapture streamId（含系统音频）
      case 'CAPTURE_SYSTEM_AUDIO':
        captureDesktop(true)
          .then((streamId) => sendResponse({ streamId }))
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // 投递回传：提交成功后更新看板
      case 'REPORT_SUBMISSION':
        bridge('/api/automation/application', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      default:
        return false
    }
  })
})
