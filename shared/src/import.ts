/**
 * 批量导入领域（B2 扩展）：URL / xlsx / CSV 岗位投递表解析。
 * 纯函数，无副作用 —— 前端解析后调用；字段名不统一时先启发式映射，可再交给 AI 标准化。
 * 分组维度用户自定义，导入时按启发式规则自动建议。
 */
import type { ApplicationStatus } from './index.js'

/* ════════════════════════════════════════════════════════════
   原始行 → 标准化投递
   ════════════════════════════════════════════════════════════ */

/** 原始行：key 为列头（任意语言/写法），value 为单元格文本 */
export type ImportRow = Record<string, unknown>

/** 标准化后的投递（可直接作为 addApplication 的载荷） */
export interface NormalizedApplication {
  company: string
  title: string
  url?: string
  jd?: string
  channel?: string
  status: ApplicationStatus
  applied_at?: string
  tags: string[]
  groups: string[]
  notes: string
  /** 行号（导入预览中展示，从 1 开始） */
  row: number
}

/** 列头 → 标准字段的启发式规则（命中即取值；按优先级排列） */
const COLUMN_RULES: Array<{ field: keyof Omit<NormalizedApplication, 'row' | 'tags' | 'groups'>; patterns: RegExp[] }> = [
  {
    field: 'company',
    patterns: [/公司名称|公司|单位|企业|employer|company/i],
  },
  {
    field: 'title',
    patterns: [/岗位名称|岗位|职位名称|职位|position|job.?title|title/i],
  },
  {
    field: 'status',
    patterns: [/状态|投递状态|进展|status/i],
  },
  {
    field: 'applied_at',
    patterns: [/投递时间|投递日期|申请时间|申请日期|日期|applied|date/i],
  },
  {
    field: 'channel',
    patterns: [/渠道|来源|平台|channel|source|platform/i],
  },
  {
    field: 'url',
    patterns: [/链接|网址|岗位链接|url|link/i],
  },
  {
    field: 'jd',
    patterns: [/JD|岗位描述|职位描述|描述|description/i],
  },
  {
    field: 'notes',
    patterns: [/备注|说明|notes|remark/i],
  },
]

/** 中文/英文状态 → 标准状态（无法识别 → backlog） */
export function normalizeStatus(raw: string): ApplicationStatus {
  const s = raw.trim().toLowerCase()
  if (!s) return 'backlog'
  if (/备选|待投|未投|backlog|pending.?apply/.test(s)) return 'backlog'
  if (/已投|已申请|已投递|applied|submitted/.test(s)) return 'applied'
  if (/已读|被读|简历被读|viewed|read/.test(s)) return 'viewed'
  if (/offer|录用|录取/.test(s)) return 'offer'
  if (/拒绝|被拒|淘汰|rejected|fail/.test(s)) return 'rejected'
  if (/放弃|撤回|取消|withdrawn|cancelled|canceled/.test(s)) return 'withdrawn'
  // round_N 或 第N面
  const roundMatch = s.match(/第\s*(\d)\s*面|round[_\s]*(\d)/)
  if (roundMatch) {
    const n = Number(roundMatch[1] ?? roundMatch[2])
    if (n >= 1 && n <= 8) return `round_${n}`
  }
  if (/面试|interview/.test(s)) return 'round_1'
  return 'backlog'
}

/** 日期归一：支持 2026-08-10 / 2026/8/10 / 2026年8月10日 / 8/10(补当前年) → YYYY-MM-DD */
export function normalizeDate(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const iso = s.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  }
  const cn = s.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日?/)
  if (cn) {
    return `${cn[1]}-${cn[2]!.padStart(2, '0')}-${cn[3]!.padStart(2, '0')}`
  }
  const short = s.match(/^(\d{1,2})[/月](\d{1,2})日?$/)
  if (short) {
    const y = new Date().getFullYear()
    return `${y}-${short[1]!.padStart(2, '0')}-${short[2]!.padStart(2, '0')}`
  }
  // Excel 序列号（数字 40000–60000 范围）
  const serial = Number(s)
  if (Number.isInteger(serial) && serial > 30000 && serial < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) as unknown as number)
    d.setUTCDate(d.getUTCDate() + serial)
    return d.toISOString().slice(0, 10)
  }
  return undefined
}

/** 单元格值 → 干净字符串 */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** 按列头规则找值 */
function pickByRules(row: ImportRow, field: string): string {
  for (const rule of COLUMN_RULES) {
    if (rule.field !== field) continue
    for (const [col, val] of Object.entries(row)) {
      if (rule.patterns.some((re) => re.test(col))) {
        const text = cellText(val)
        if (text) return text
      }
    }
  }
  return ''
}

/* ════════════════════════════════════════════════════════════
   自动分组建议（用户可自定义维度，这里给默认建议）
   ════════════════════════════════════════════════════════════ */

/** 岗位类型关键词 → 分组名 */
const TITLE_GROUPS: Array<[RegExp, string]> = [
  [/前端|frontend|front.?end/i, '前端'],
  [/后端|backend|back.?end|服务端/i, '后端'],
  [/全栈|full.?stack/i, '全栈'],
  [/算法|algorithm|机器学习|深度学习|AI|NLP/i, '算法'],
  [/安全|渗透|红队|蓝队|security|penetration/i, '安全'],
  [/测试|test|QA|质量/i, '测试'],
  [/产品|product.?manager|PM\b/i, '产品'],
  [/运营|operations/i, '运营'],
  [/数据|data|BI/i, '数据'],
  [/运维|devops|SRE/i, '运维'],
  [/实习|intern/i, '实习'],
]

/** 从岗位名建议类型分组 */
function suggestTitleGroup(title: string): string | undefined {
  for (const [re, group] of TITLE_GROUPS) {
    if (re.test(title)) return group
  }
  return undefined
}

/** 从文本提取城市（常见城市白名单匹配） */
const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '苏州',
  '天津', '长沙', '郑州', '重庆', '合肥', '厦门', '福州', '青岛', '济南', '大连',
  '宁波', '无锡', '佛山', '东莞', '昆明', '沈阳', '哈尔滨', '石家庄', '南昌', '贵阳',
]

function suggestCity(text: string): string | undefined {
  for (const city of CITIES) {
    if (text.includes(city)) return city
  }
  return undefined
}

/**
 * 自动分组建议：
 * - 岗位类型（title 关键词）
 * - 渠道（channel 直接作为分组）
 * - 城市（JD / 备注中出现的城市白名单）
 * 返回去重后的分组标签列表；用户可在导入预览中增删自定义分组。
 */
export function suggestGroups(app: Pick<NormalizedApplication, 'title' | 'channel' | 'jd' | 'notes' | 'company'>): string[] {
  const groups: string[] = []
  const titleGroup = suggestTitleGroup(app.title)
  if (titleGroup) groups.push(titleGroup)
  if (app.channel && app.channel.length <= 10) groups.push(app.channel)
  const city = suggestCity(`${app.jd ?? ''} ${app.notes ?? ''}`)
  if (city) groups.push(city)
  return [...new Set(groups)].slice(0, 4)
}

/* ════════════════════════════════════════════════════════════
   行 → 标准化投递
   ════════════════════════════════════════════════════════════ */

/** 解析标签单元格（"安全,渗透" / "安全；渗透" / "安全、渗透"） */
function parseTagCell(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,，;；、|/]/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ]
}

/** 单行原始数据 → 标准化投递（启发式）；company/title 均空的行返回 null */
export function normalizeImportRow(row: ImportRow, rowNumber: number): NormalizedApplication | null {
  const company = pickByRules(row, 'company')
  const title = pickByRules(row, 'title')
  if (!company && !title) return null

  const statusRaw = pickByRules(row, 'status')
  const appliedRaw = pickByRules(row, 'applied_at')
  const channelRaw = pickByRules(row, 'channel')
  const urlRaw = pickByRules(row, 'url')
  const jdRaw = pickByRules(row, 'jd')
  const notesRaw = pickByRules(row, 'notes')

  // 标签：先找"标签/关键词/技能"列
  let tagList: string[] = []
  for (const [col, val] of Object.entries(row)) {
    if (/标签|关键词|技能|tags?|keywords?/i.test(col)) {
      tagList = parseTagCell(cellText(val))
      break
    }
  }

  const appliedAt = appliedRaw ? normalizeDate(appliedRaw) : undefined
  const status = statusRaw ? normalizeStatus(statusRaw) : appliedAt ? 'applied' : 'backlog'

  const draft: NormalizedApplication = {
    company: company || '未知公司',
    title: title || '未命名岗位',
    url: urlRaw || undefined,
    jd: jdRaw || undefined,
    channel: channelRaw || undefined,
    status,
    applied_at: appliedAt,
    tags: tagList,
    groups: [],
    notes: notesRaw,
    row: rowNumber,
  }
  draft.groups = suggestGroups(draft)
  return draft
}

/** 批量标准化：跳过空行，返回有效投递列表 */
export function normalizeImportRows(rows: ImportRow[]): NormalizedApplication[] {
  const result: NormalizedApplication[] = []
  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeImportRow(rows[i] ?? {}, i + 1)
    if (normalized) result.push(normalized)
  }
  return result
}

/** 导入去重：按 url 优先，其次 company+title 组合；返回去重后的列表与重复数 */
export function dedupeImported(
  items: NormalizedApplication[],
  existing: Array<{ url?: string; company: string; title: string }>,
): { unique: NormalizedApplication[]; duplicates: number } {
  const seenUrl = new Set(existing.map((e) => e.url).filter(Boolean) as string[])
  const seenKey = new Set(existing.map((e) => `${e.company}::${e.title}`))
  const unique: NormalizedApplication[] = []
  let duplicates = 0
  for (const it of items) {
    const key = `${it.company}::${it.title}`
    if (it.url && seenUrl.has(it.url)) {
      duplicates++
      continue
    }
    if (!it.url && seenKey.has(key)) {
      duplicates++
      continue
    }
    if (it.url) seenUrl.add(it.url)
    seenKey.add(key)
    unique.push(it)
  }
  return { unique, duplicates }
}

/* ════════════════════════════════════════════════════════════
   CSV 解析（零依赖：处理引号包裹的逗号、换行转义）
   ════════════════════════════════════════════════════════════ */

/** 解析 CSV 文本为对象数组（首行为表头） */
export function parseCsv(text: string): ImportRow[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let cur = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  if (rows.length < 2) return []
  const headers = rows[0]!.map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const obj: ImportRow = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = cells[i] ?? ''
    })
    return obj
  })
}
