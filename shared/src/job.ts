/**
 * 岗位市场领域（模块 G）：岗位库 + 来源适配 + 去重 + 收藏 / 转入投递。
 *
 * 设计要点：
 * - 岗位是**独立于投递**的一等实体：先入库、可筛选比较，再决定投不投；转入投递后双向关联。
 * - **来源与服务解耦**：本应用不内置爬虫。岗位来源分三类 ——
 *   ① 手动录入；② 浏览器插件采集（复用登录态）；③ 外部抓取服务（你自己跑的独立进程，
 *      通过 `JobSourceConfig.endpoint` 接入，协议见 JOB_SOURCE_PROTOCOL）。
 *   求职方舟这类站点作为「来源之一」以 kind='web' 形式挂进去（打开站点 + 插件采集）。
 * - 字段能力复用 shared/property.ts 的多维表格机制（自定义属性 / 筛选 / 排序 / 视图）。
 *
 * ⚠️ 合规：只接公开可访问的信息；对需要登录或明确反爬的站点，走「插件在你已登录的
 * 浏览器里采集」而不是服务端抓取。
 */
import type { JobPosting, PropertyDef, PropertyValues } from './index.js'
import { resolveFields, type ResolvedField } from './property.js'

/* ── 来源 ─────────────────────────────────────────────────── */

/** 来源类型：手动 / 插件采集 / 外部抓取服务 / 站点入口 */
export type JobSourceKind = 'manual' | 'plugin' | 'service' | 'web'

export interface JobSourceConfig {
  id: string
  name: string
  kind: JobSourceKind
  /** kind='service' 时的服务基址，如 http://127.0.0.1:8790 */
  endpoint?: string
  /** kind='web' 时的站点首页（用插件去采集） */
  homepage?: string
  enabled: boolean
  /** 给用户看的说明（数据范围 / 注意事项） */
  note?: string
}

/** 内置来源（首版给的几个公开入口，用户可增删改） */
export const DEFAULT_JOB_SOURCES: JobSourceConfig[] = [
  {
    id: 'manual',
    name: '手动录入',
    kind: 'manual',
    enabled: true,
    note: '随手记一个岗位；适合内推、线下渠道',
  },
  {
    id: 'plugin',
    name: '浏览器插件采集',
    kind: 'plugin',
    enabled: true,
    note: '在官网 / 招聘平台页面点插件采集，复用你已登录的会话',
  },
  {
    id: 'local-service',
    name: '本地抓取服务',
    kind: 'service',
    endpoint: 'http://127.0.0.1:8790',
    enabled: false,
    note: '你自己跑的独立抓取进程（爬虫与主程序分离），协议见文档；填好地址后再启用',
  },
  {
    id: 'qiuzhifangzhou',
    name: '求职方舟',
    kind: 'web',
    homepage: 'https://www.qiuzhifangzhou.com/job',
    enabled: true,
    note: '第三方岗位聚合站（来源之一）；用插件在其结果页采集，或按需人工复制',
  },
  {
    id: 'guopin',
    name: '国聘 / 央国企招聘',
    kind: 'web',
    homepage: 'https://www.iguopin.com/',
    enabled: false,
    note: '公开的央国企岗位入口',
  },
]

/**
 * 外部抓取服务协议（用户自建服务实现这个即可被本应用消费）。
 *
 *   GET {endpoint}/jobs?query=<关键词>&city=<城市>&page=<页>&limit=<条数>
 *   → 200 application/json
 *   {
 *     "jobs": [
 *       { "external_id": "…", "title": "…", "company": "…", "city": "…",
 *         "salary": "…", "education": "…", "experience": "…", "job_type": "校招",
 *         "url": "…", "jd": "…", "tags": ["…"], "posted_at": "2026-09-01",
 *         "deadline": "2026-10-01" }
 *     ],
 *     "total": 123,          // 可选
 *     "next_page": 2         // 可选
 *   }
 *
 * 只要求 jobs[] 里 title/company 至少有一个；其余字段能填就填。
 */
export const JOB_SOURCE_PROTOCOL = {
  path: '/jobs',
  requiredFields: ['title'],
  optionalFields: [
    'external_id',
    'company',
    'city',
    'salary',
    'education',
    'experience',
    'job_type',
    'url',
    'jd',
    'tags',
    'posted_at',
    'deadline',
  ],
} as const

/** 把外部服务返回的一条原始记录规整成 JobPosting 可用的字段 */
export function normalizeRemoteJob(
  raw: Record<string, unknown>,
  sourceId: string,
): Omit<JobPosting, 'id' | 'created_at' | 'updated_at'> | null {
  const str = (k: string): string | undefined => {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
    return undefined
  }
  const title = str('title')
  const company = str('company') ?? ''
  if (!title && !company) return null
  const tagsRaw = raw.tags
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim())
    : typeof tagsRaw === 'string' && tagsRaw.trim()
      ? tagsRaw.split(/[,，、\s]+/).filter(Boolean)
      : []
  return {
    title: title ?? '',
    company,
    source_id: sourceId,
    external_id: str('external_id'),
    url: str('url'),
    city: str('city'),
    salary: str('salary'),
    education: str('education'),
    experience: str('experience'),
    job_type: str('job_type'),
    jd: str('jd'),
    tags,
    company_tags: [],
    starred: false,
    posted_at: str('posted_at'),
    deadline: str('deadline'),
  }
}

/* ── 字段表（复用多维表格机制） ───────────────────────────── */

/** 岗位内置字段（表格列 / 筛选项；顺序即默认列顺序） */
export const JOB_BUILTIN_FIELDS: ResolvedField[] = [
  { key: 'title', name: '岗位名称', kind: 'text', custom: false },
  { key: 'company', name: '公司', kind: 'text', custom: false },
  { key: 'city', name: '城市', kind: 'text', custom: false },
  { key: 'salary', name: '薪资', kind: 'text', custom: false },
  { key: 'job_type', name: '类型', kind: 'text', custom: false },
  { key: 'education', name: '学历要求', kind: 'text', custom: false },
  { key: 'experience', name: '经验要求', kind: 'text', custom: false },
  { key: 'company_tags', name: '公司标签', kind: 'tags', custom: false },
  { key: 'tags', name: '岗位标签', kind: 'tags', custom: false },
  { key: 'source_id', name: '来源', kind: 'text', custom: false },
  { key: 'match_score', name: '匹配度', kind: 'number', custom: false },
  { key: 'posted_at', name: '发布时间', kind: 'date', custom: false },
  { key: 'deadline', name: '截止时间', kind: 'date', custom: false },
  { key: 'starred', name: '收藏', kind: 'boolean', custom: false },
  { key: 'url', name: '岗位链接', kind: 'text', custom: false },
  { key: 'jd', name: 'JD', kind: 'text', custom: false },
]

/** 岗位表格默认显示的列 */
export const JOB_DEFAULT_VISIBLE_FIELDS = [
  'title',
  'company',
  'city',
  'salary',
  'job_type',
  'company_tags',
  'match_score',
  'posted_at',
]

/** 岗位字段 = 岗位内置字段 + 岗位自定义属性 */
export function jobFields(properties: PropertyDef[]): ResolvedField[] {
  return resolveFields(properties, JOB_BUILTIN_FIELDS)
}

/* ── 去重 ─────────────────────────────────────────────────── */

/** 归一化文本：去空白 / 常见分隔符 / 全角括号，便于判重 */
function norm(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[\s\u3000·・\-—_/\\|,，.。()（）\[\]【】]/g, '')
}

/**
 * 岗位去重键：
 * - 有来源 + 外部 id → 用「来源:外部id」（最可靠）
 * - 否则用「归一化(公司)|(岗位)|(城市)」
 */
export function jobKey(job: {
  source_id?: string
  external_id?: string
  company?: string
  title?: string
  city?: string
}): string {
  if (job.external_id) return `x:${job.source_id ?? ''}:${job.external_id}`
  return `n:${norm(job.company)}|${norm(job.title)}|${norm(job.city)}`
}

/** 按 key 去重（保留先到的），返回新条目与被跳过的重复数 */
export function dedupeJobs<T extends { source_id?: string; external_id?: string; company?: string; title?: string; city?: string }>(
  incoming: T[],
  existingKeys: Set<string>,
): { fresh: T[]; duplicates: number } {
  const fresh: T[] = []
  let duplicates = 0
  for (const job of incoming) {
    const key = jobKey(job)
    if (existingKeys.has(key)) {
      duplicates++
      continue
    }
    existingKeys.add(key)
    fresh.push(job)
  }
  return { fresh, duplicates }
}

/* ── 转入投递 ─────────────────────────────────────────────── */

/** 岗位 → 投递载荷（保持两边字段语义一致） */
export function jobToApplicationDraft(
  job: JobPosting,
  firstColumnId: string,
): {
  company: string
  title: string
  status: string
  url?: string
  jd?: string
  channel?: string
  tags: string[]
  groups: string[]
  notes: string
} {
  const notes = [
    job.city ? `城市：${job.city}` : '',
    job.salary ? `薪资：${job.salary}` : '',
    job.job_type ? `类型：${job.job_type}` : '',
    job.deadline ? `截止：${job.deadline}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return {
    company: job.company,
    title: job.title || '未命名岗位',
    status: firstColumnId,
    url: job.url,
    jd: job.jd,
    channel: job.source_id,
    tags: [...job.tags],
    groups: [],
    notes,
  }
}

/** 收藏 / 公司标签 / 匹配分的默认值（新建岗位时补齐） */
export function emptyJobExtras(): Pick<JobPosting, 'tags' | 'company_tags' | 'starred'> & {
  properties?: PropertyValues
} {
  return { tags: [], company_tags: [], starred: false }
}
