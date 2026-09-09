/**
 * background service worker：消息路由 + 本地桥（127.0.0.1:8000）调用。
 *
 * 已实现（对齐 src-tauri/src/bridge.rs 的路由）：
 * - 配对：popup 粘贴配对码存 chrome.storage.local，请求带 Authorization: Bearer <token>
 * - 本地桥端点：
 *     GET       /api/automation/profile        读取当前档案（供填充）
 *     POST      /api/automation/job            采集岗位回传
 *     POST      /api/automation/application    投递结果回传
 *     GET/POST  /api/automation/form-mapping   站点字段映射记忆（per-origin）
 *     POST      /api/automation/ai/*           AI 模式：字段识别 / 岗位提取 / 简历生成
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
  function captureDesktop(withAudio: boolean): Promise<string | null> {
    return new Promise((resolve) => {
      const types: Array<'screen' | 'audio' | 'tab'> = withAudio ? ['screen', 'audio'] : ['screen']
      chrome.desktopCapture.chooseDesktopMedia(types, (streamId) => resolve(streamId || null))
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
      // 站点字段映射：读取（per-origin 记忆）
      case 'GET_FORM_MAPPING':
        bridge(`/api/automation/form-mapping?origin=${encodeURIComponent(message.payload?.origin ?? '')}`)
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // 站点字段映射：上报（记忆）
      case 'REPORT_FORM_MAPPING':
        bridge('/api/automation/form-mapping', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // AI 模式：表单字段语义识别
      case 'ANALYZE_FIELDS':
        bridge('/api/automation/ai/analyze-fields', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // AI 模式：岗位信息提取
      case 'EXTRACT_JOB':
        bridge('/api/automation/ai/extract-job', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      // AI 模式：简历生成
      case 'GENERATE_RESUME':
        bridge('/api/automation/ai/generate-resume', { method: 'POST', body: JSON.stringify(message.payload) })
          .then(sendResponse)
          .catch((e) => sendResponse({ error: String(e) }))
        return true
      default:
        return false
    }
  })
})
