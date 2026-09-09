/**
 * content script：投递表单扫描 / 填充 / 高亮 / 人工确认 + 岗位采集。
 * 合规硬约束：不做自动提交、不破验证码、不绕过登录 —— 填充后由用户确认提交。
 *
 * 两种识别模式（popup 切换）：
 * - 关键词：本地规则（name/id/label 关键词）+ per-origin 映射记忆，纯离线
 * - AI：把字段上下文发给桥，由桥内模型做语义映射，结果同样记忆复用
 *
 * 动态渲染页面：填充前用 MutationObserver 等待表单挂载（waitForForm），
 * 避免 SPA 在 document_idle 之后才渲染导致的「0 个字段」。
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

    /** 字段标识（用于 per-origin 映射记忆的 key；优先 name → id → label） */
    function fieldIdentity(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
      // 注意：?? 不能与 || 混用而不加括号（Babel/JS 语法错误），统一用 || 兜底空串
      return (
        (el.getAttribute('name') ?? '').trim() ||
        el.id ||
        el.closest('label')?.textContent?.trim() ||
        ''
      )
    }

    function fieldKeyOf(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
      const name = (el.getAttribute('name') ?? '').toLowerCase()
      const id = (el.id ?? '').toLowerCase()
      const label = el.closest('label')?.textContent ?? ''
      for (const [re, key] of FIELD_RULES) {
        if (re.test(name) || re.test(id) || re.test(label)) return key
      }
      return ''
    }

    /** 可填充控件（排除隐藏域与按钮类，它们无法承载档案文本） */
    function fillableControls(): NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
      return document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select',
      )
    }

    /**
     * 等待表单挂载：SPA（React/Vue）常在 document_idle 之后才渲染表单。
     * MutationObserver 监听 DOM，出现可填充控件或超时后返回。
     */
    function waitForForm(timeoutMs = 5000): Promise<boolean> {
      if (fillableControls().length > 0) return Promise.resolve(true)
      return new Promise((resolve) => {
        let timer: ReturnType<typeof setTimeout>
        const observer = new MutationObserver(() => {
          if (fillableControls().length > 0) {
            observer.disconnect()
            clearTimeout(timer)
            resolve(true)
          }
        })
        timer = setTimeout(() => {
          observer.disconnect()
          resolve(false)
        }, timeoutMs)
        observer.observe(document.documentElement, { childList: true, subtree: true })
      })
    }

    function scanFields(): Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; key: string; identity: string }> {
      const found: Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; key: string; identity: string }> = []
      const els = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select',
      )
      for (const el of els) {
        const key = fieldKeyOf(el)
        if (key) found.push({ el, key, identity: fieldIdentity(el) })
      }
      return found
    }

    /**
     * 写入值并派发 input/change + 高亮。
     * React 受控输入直接赋 .value 不会更新框架内部 state（值会被回滚），
     * 必须走原型上的原生 setter 绕过 valueTracker —— 两种模式共用这一处。
     */
    function setControlValue(
      el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      value: string,
    ): boolean {
      if (el instanceof HTMLSelectElement) {
        const opt = Array.from(el.options).find((o) => o.value === value || o.text === value)
        if (!opt) return false
        el.value = opt.value
      } else {
        const proto =
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        if (setter) setter.call(el, value)
        else el.value = value
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.style.outline = '2px solid #111827'
      el.style.outlineOffset = '1px'
      return true
    }

    /** 从后台拉取当前 origin 的已知字段映射（记忆） */
    async function fetchMappings(): Promise<Map<string, string>> {
      const origin = location.origin
      if (!origin || origin === 'null') return new Map()
      const res = await chrome.runtime
        .sendMessage({ type: 'GET_FORM_MAPPING', payload: { origin } })
        .catch(() => null)
      const mappings = (res?.mappings as Array<{ field_key: string; target_field: string }> | undefined) ?? []
      return new Map(mappings.map((m) => [m.field_key, m.target_field]))
    }

    /** 把新发现的映射上报记忆（异步 fire-and-forget） */
    function reportMappings(mappings: Array<{ identity: string; target: string }>, controlTypes?: Map<string, string>): void {
      const origin = location.origin
      if (!origin || origin === 'null' || !mappings.length) return
      for (const m of mappings) {
        const controlType = controlTypes?.get(m.identity) ?? undefined
        chrome.runtime.sendMessage({
          type: 'REPORT_FORM_MAPPING',
          payload: { origin, field_key: m.identity, target_field: m.target, control_type: controlType },
        }).catch(() => {})
      }
    }

    /**
     * 填充（关键词模式）：档案字段值写入匹配控件并高亮（不提交）。
     * 优先级：站点映射记忆（per-origin）> 本地启发式规则；填充成功的映射回传记忆。
     */
    function fillForm(
      profile: {
        full_name?: string
        email?: string
        phone?: string
        headline?: string
        summary?: string
      },
      remembered: Map<string, string>,
    ): { filled: string[]; unmapped: string[] } {
      const fields = scanFields()
      const filled: string[] = []
      const values: Record<string, string | undefined> = {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        headline: profile.headline,
        summary: profile.summary,
      }
      const learned: Array<{ identity: string; target: string }> = []
      const controlTypes = new Map<string, string>()
      for (const { el, key, identity } of fields) {
        // 映射优先级：记忆映射 > 本地启发式
        const target = remembered.get(identity) ?? key
        const value = values[target]
        controlTypes.set(identity, el.tagName.toLowerCase() === 'select' ? 'select' : el.tagName.toLowerCase())
        if (!value) continue
        // 统一走 setControlValue（原生 setter），否则 React 受控输入会被回滚
        if (!setControlValue(el, value)) continue
        filled.push(target)
        // 启发式命中且与记忆不同 → 学习上报
        if (!remembered.has(identity) && key && target === key) learned.push({ identity, target })
      }
      reportMappings(learned, controlTypes)
      const filledKeys = new Set(filled)
      const unmapped = fields.filter((f) => !filledKeys.has(f.key) && !filledKeys.has(remembered.get(f.identity) ?? '')).map((f) => f.identity || f.key)
      return { filled, unmapped }
    }

    /** 提取页面可读文本（供 AI 岗位提取） */
    function collectPageText(): string {
      const meta =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
      const body = document.body?.innerText?.slice(0, 5000) ?? ''
      return `${meta}\n${body}`.trim()
    }

    /** 详细字段扫描（AI 模式）：收集完整上下文供 AI 语义识别 */
    interface FieldDetail {
      index: number
      name: string
      id: string
      label: string
      placeholder: string
      type: string
      nearby: string
    }

    function scanFieldsDetailed(): Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; info: FieldDetail }> {
      const found: Array<{ el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; info: FieldDetail }> = []
      let index = 0
      const els = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select',
      )
      for (const el of els) {
        const tag = el.tagName.toLowerCase()
        const inputType = tag === 'input' ? (el as HTMLInputElement).type ?? '' : ''
        if (tag === 'input' && ['hidden', 'submit', 'button', 'reset'].includes(inputType)) continue
        found.push({
          el,
          info: {
            index: index++,
            name: el.getAttribute('name') ?? '',
            id: el.id ?? '',
            label: el.closest('label')?.textContent?.trim() ?? '',
            placeholder: el.getAttribute('placeholder') ?? '',
            type: tag === 'input' ? `input:${inputType}` : tag,
            nearby: el.parentElement?.textContent?.trim().slice(0, 120) ?? '',
          },
        })
      }
      return found
    }

    /** 按目标字段写值到控件（排除禁用 / 特殊控件，实际写入复用 setControlValue） */
    function fillByTarget(
      el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      target: string,
      values: Record<string, string | undefined>,
    ): boolean {
      const value = values[target]
      if (!value) return false
      // 排除禁用 / 特殊控件（checkbox/radio/file 无法简单赋 value）
      if (el instanceof HTMLInputElement) {
        if (el.disabled) return false
        const type = el.type ?? ''
        if (['checkbox', 'radio', 'file', 'hidden', 'submit', 'button', 'reset'].includes(type)) return false
      } else if (el.disabled) {
        return false
      }
      return setControlValue(el, value)
    }

    /** AI 模式填充：发字段上下文给后台 → 桥 AI 映射 → 按映射填充 */
    async function fillFormAI(profile: {
      full_name?: string
      email?: string
      phone?: string
      headline?: string
      summary?: string
    }): Promise<{ filled: string[]; unmapped: string[] }> {
      const detailed = scanFieldsDetailed()
      if (!detailed.length) return { filled: [], unmapped: [] }
      const res = await chrome.runtime.sendMessage({
        type: 'ANALYZE_FIELDS',
        payload: { fields: detailed.map((d) => d.info) },
      })
      if (!res?.mappings) throw new Error(res?.error ?? 'AI 识别失败')
      // AI 返回的 key 可能是 index / name / id / label，都建立索引
      const mappingByKey = new Map<string, string>(
        (res.mappings as Array<{ key: string; target: string }>).map((m) => [String(m.key), m.target]),
      )
      const values: Record<string, string | undefined> = {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        headline: profile.headline,
        summary: profile.summary,
      }
      const filled: string[] = []
      const unmapped: string[] = []
      const learned: Array<{ identity: string; target: string }> = []
      const controlTypes = new Map<string, string>()
      for (const { el, info } of detailed) {
        const target =
          mappingByKey.get(String(info.index)) ??
          mappingByKey.get(info.name) ??
          mappingByKey.get(info.id) ??
          mappingByKey.get(info.label)
        const identity = fieldIdentity(el)
        controlTypes.set(identity, info.type === 'select' ? 'select' : info.type)
        if (target && target !== 'other' && fillByTarget(el, target, values)) {
          filled.push(target)
          // AI 识别出的映射也记忆，下次关键词模式直接复用
          if (identity) learned.push({ identity, target })
        } else {
          unmapped.push(info.name || info.id || info.label || `#${info.index}`)
        }
      }
      reportMappings(learned, controlTypes)
      return { filled, unmapped }
    }

    function removeHighlights(): void {
      document
        .querySelectorAll('input, textarea, select')
        .forEach((el) => ((el as HTMLElement).style.outline = ''))
    }

    /** 投递回传：提交成功后通知后台 → 本地桥更新看板（监听器去重，避免多次填充累积） */
    let submitHandler: ((e: Event) => void) | null = null
    function watchSubmission(applicationId?: string): void {
      if (submitHandler) document.removeEventListener('submit', submitHandler, true)
      submitHandler = (e: Event): void => {
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
      document.addEventListener('submit', submitHandler, true)
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message?.type) {
        case 'COLLECT_CURRENT_PAGE':
          sendResponse(collectJobInfo())
          break
        case 'COLLECT_PAGE_TEXT':
          // AI 岗位提取用：返回页面可读文本
          sendResponse({ text: collectPageText(), title: document.title, url: location.href })
          break
        case 'FILL_FORM':
          // 读识别模式：关键词（本地规则 + 站点映射记忆）/ AI（桥语义识别）
          chrome.storage.local.get('mode', (s) => {
            const useAi = s.mode === 'ai'
            chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, async (res) => {
              if (res?.profile) {
                try {
                  // SPA 可能尚未渲染表单：先等控件出现（最多 5s），再扫描
                  await waitForForm()
                  const r = useAi
                    ? await fillFormAI(res.profile)
                    : fillForm(res.profile, await fetchMappings())
                  watchSubmission(res.applicationId)
                  sendResponse({ ok: true, ...r })
                } catch (e) {
                  sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
                }
              } else {
                sendResponse({ ok: false, error: res?.error ?? '未获取到档案（请先配对并建档）' })
              }
            })
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
