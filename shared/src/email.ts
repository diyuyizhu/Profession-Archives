/**
 * 邮箱内容 → 投递信息解析（本地启发式）。
 * 用户把招聘往来邮件粘贴进来，提取 公司 / 岗位 / 面试时间 / 平台，预填看板。
 * 接入后端 AI（模块 E）后可升级为语义解析。
 */

export interface EmailParseResult {
  company?: string
  title?: string
  /** 面试 / 投递相关日期（YYYY-MM-DD） */
  date?: string
  /** 时间（HH:mm） */
  time?: string
  /** 平台（如 BOSS 直聘 / 猎聘 / 内推） */
  platform?: string
  /** 关键句（供用户核验） */
  lines: string[]
  /** 置信度 0–1 */
  confidence: number
}

/** 常见招聘平台关键词 → 平台名 */
const PLATFORMS: Array<[RegExp, string]> = [
  [/BOSS.{0,2}直聘/i, 'BOSS 直聘'],
  [/拉勾/i, '拉勾'],
  [/猎聘/i, '猎聘'],
  [/智联/i, '智联招聘'],
  [/前程无忧|51job/i, '前程无忧'],
  [/内推/i, '内推'],
  [/牛客/i, '牛客'],
]

/** 常见面试软件关键词 */
const MEETING_TOOLS = ['腾讯会议', '飞书', '钉钉', 'Zoom', 'Teams', 'Meet', '瞩目']

/** 校验月/日是否在合法范围 */
function validDate(y: number, m: number, d: number): boolean {
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12)) return false
  const maxDay = new Date(y, m, 0).getDate() // 该月天数
  return d >= 1 && d <= maxDay
}

/** 提取第一个日期（2026-08-10 / 2026/08/10 / 2026年8月10日） */
function extractDate(text: string): string | undefined {
  const iso = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (validDate(y, m, d)) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // 中文日期：年份就近捕获（避免全局取第一个 20xx 年）
  const cn = text.match(/(?:(\d{4})年)?\s*(\d{1,2})月(\d{1,2})日?/)
  if (cn) {
    const y = cn[1] ? Number(cn[1]) : new Date().getFullYear()
    const m = Number(cn[2])
    const d = Number(cn[3])
    if (validDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return undefined
}

/** 提取时间（14:00 / 下午 2 点 / 14 时） */
function extractTime(text: string): string | undefined {
  const hm = text.match(/(\d{1,2})[:：](\d{2})/)
  if (hm) return `${String(Number(hm[1])).padStart(2, '0')}:${hm[2]}`
  const cn = text.match(/(?:下午|晚上)?\s*(\d{1,2})\s*[点時时]/)
  if (cn) {
    let h = Number(cn[1])
    if (/下午|晚上/.test(text) && h < 12) h += 12
    return `${String(h).padStart(2, '0')}:00`
  }
  return undefined
}

/** 公司名：优先"XX公司/集团的面试邀请"，其次"到XX面试"等 */
function extractCompany(text: string): string | undefined {
  const m =
    text.match(/([^，。,;；\s]{2,20}?(?:公司|集团|科技|网络|软件|数据|实验室|工作室))/i) ??
    text.match(/到\s*([^，。,;；\s]{2,20}?)\s*(?:面试|参加|报到)/)
  return m?.[1]?.trim()
}

/** 岗位：动词前缀（面试/应聘/参加…）后接 1–3 个空格分隔词 + 结构性后缀（岗位/职位/一职/职/岗） */
function extractTitle(text: string): string | undefined {
  const word = '[一-龥A-Za-z0-9（）()·/+\\-]'
  const suffix = '(?:岗位|职位|一职|职|岗)'
  const m =
    text.match(
      new RegExp(`(?:面试|应聘|投递|参加|进行|安排)(?:的)?\\s*((?:${word}+\\s*){1,3}?)${suffix}`),
    ) ??
    text.match(/岗位[：:]\s*([^\n，。,]{2,30})/)
  if (!m?.[1]) return undefined
  let name = m[1].replace(/\s+/g, ' ').trim()
  // 只切开头的动词/时间词（"明天参加 前端开发工程师岗" → "前端开发工程师"）；
  // 不做全串 indexOf 截断，避免误伤标题中间的合法动词（如"面试官培训"）。
  const verbs = ['面试', '参加', '安排', '进行', '应聘', '投递', '邀请', '明天', '今天', '上午', '下午', '晚上']
  let changed = true
  while (changed) {
    changed = false
    for (const v of verbs) {
      if (name.startsWith(v)) {
        name = name.slice(v.length).trim()
        changed = true
        break
      }
    }
  }
  return name.length >= 2 ? name : undefined
}

/** 邮箱内容 → 投递信息（本地启发式解析） */
export function parseEmailForApplication(text: string): EmailParseResult {
  const t = text.replace(/\r/g, '')
  const result: EmailParseResult = { lines: [], confidence: 0 }

  result.company = extractCompany(t)
  result.title = extractTitle(t)
  result.date = extractDate(t)
  result.time = extractTime(t)

  for (const [re, name] of PLATFORMS) {
    if (re.test(t)) {
      result.platform = name
      break
    }
  }

  // 关键句：含"面试"或时间信息的行
  const lines = t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 80)
  const hints = lines.filter(
    (l) => /面试|邀请|您好|时间|地点|会议|安排|职位|岗位|薪资|offer/i.test(l),
  )
  result.lines = hints.slice(0, 6)

  // 置信度：命中项越多越高
  const hits = [result.company, result.title, result.date, result.platform].filter(Boolean).length
  const hasInterview = /面试|邀请/i.test(t)
  result.confidence = hasInterview ? Math.min(0.95, 0.5 + hits * 0.12) : Math.min(0.5, hits * 0.15)

  return result
}

/** 是否疑似招聘面试邮件（供导入入口提示） */
export function looksLikeInterviewEmail(text: string): boolean {
  return /面试|招聘|offer|邀请|入职/i.test(text)
}
