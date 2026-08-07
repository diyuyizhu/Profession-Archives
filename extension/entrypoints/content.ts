/**
 * content script：投递表单扫描 / 填充 / 高亮 / 人工确认 + 岗位采集。
 * 合规硬约束：不做自动提交、不破验证码、不绕过登录 —— 填充后由用户确认提交。
 * TODO：动态页面（React/Vue）用 MutationObserver 等待表单稳定；必填校验失败时提示。
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    interface JobInfo {
      title: string
      url: string
      company?: string
      jd?: string
    }

    function collectJobInfo(): JobInfo | null {
      const title = document.title?.trim()
      if (!title) return null
      // 启发式：从标题/页面提取公司名（"XX公司 - 岗位"）
      const company = title.split(/[-_|·]/)[0]?.trim() || undefined
      const meta = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined
      return { title, url: location.href, company, jd: meta }
    }

    // ── 字段识别启发式（D3）：name/id/label 关键词 → 档案字段 ──
    const FIELD_RULES: Array<[RegExp, string]> = [
      [/fullname|full_name|realname|your.?name|user.?name/i, 'full_name'],
      [/^email|mail/i, 'email'],
      [/phone|mobile|tel/i, 'phone'],
      [/headline|job.?title|position/i, 'headline'],
      [/summary|bio|intro|about/i, 'summary'],
    ]

    function fieldKeyOf(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
      const name = (el.getAttribute('name') ?? '').toLowerCase()
      const id = (el.id ?? '').toLowerCase()
      const label = el.closest('label')?.textContent ?? ''
      for (const [re, key] of FIELD_RULES) {
        if (re.test(name) || re.test(id) || re.test(label)) return key
      }
      return ''
    }

    function scanFields(): Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; key: string }> {
      const found: Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; key: string }> = []
      const els = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select',
      )
      for (const el of els) {
        const key = fieldKeyOf(el)
        if (key) found.push({ el, key })
      }
      return found
    }

    /** 填充：把档案字段值写入匹配控件并高亮（不提交） */
    function fillForm(profile: {
      full_name?: string
      email?: string
      phone?: string
      headline?: string
      summary?: string
    }): { filled: string[]; unmapped: string[] } {
      const fields = scanFields()
      const filled: string[] = []
      const values: Record<string, string | undefined> = {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        headline: profile.headline,
        summary: profile.summary,
      }
      for (const { el, key } of fields) {
        const value = values[key]
        if (!value) continue
        const tag = el.tagName.toLowerCase()
        if (tag === 'select') {
          const opt = Array.from(el.options).find((o) => o.value === value || o.text === value)
          if (opt) el.value = opt.value
          else continue
        } else {
          el.value = value
        }
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.style.outline = '2px solid #32f08c'
        el.style.outlineOffset = '1px'
        filled.push(key)
      }
      const filledKeys = new Set(filled)
      const unmapped = fields.filter((f) => !filledKeys.has(f.key)).map((f) => f.key)
      return { filled, unmapped }
    }

    function removeHighlights(): void {
      document
        .querySelectorAll('input, textarea, select')
        .forEach((el) => ((el as HTMLElement).style.outline = ''))
    }

    /** 投递回传：提交成功后通知后台 → 本地桥更新看板 */
    function watchSubmission(applicationId?: string): void {
      const onSubmit = (e: Event): void => {
        const form = e.target as HTMLFormElement
        chrome.runtime.sendMessage({
          type: 'REPORT_SUBMISSION',
          payload: {
            applicationId,
            company: collectJobInfo()?.company,
            title: collectJobInfo()?.title,
            status: 'applied',
            appliedAt: new Date().toISOString().slice(0, 10),
          },
        })
        removeHighlights()
        void form
      }
      document.addEventListener('submit', onSubmit, true)
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message?.type) {
        case 'COLLECT_CURRENT_PAGE':
          sendResponse(collectJobInfo())
          break
        case 'FILL_FORM':
          // 拉取档案 → 填充 + 高亮
          chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (res) => {
            if (res?.profile) {
              const r = fillForm(res.profile)
              watchSubmission(res.applicationId)
              sendResponse({ ok: true, ...r })
            } else {
              sendResponse({ ok: false, error: res?.error ?? '未获取到档案（请先配对并建档）' })
            }
          })
          return true
        case 'CLEAR_FILL':
          removeHighlights()
          sendResponse({ ok: true })
          break
        default:
          sendResponse({ ok: false, error: '未知消息' })
      }
      return false
    })
  },
})
