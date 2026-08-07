/**
 * AI 辅助能力（模块 E / B3）本地启发式实现 —— 纯函数，前端/服务端共用。
 * 说明：接入后端 AI Provider（DeepSeek/Ollama）后，模型真实调用替换这里的规则实现；
 * 启发式作为离线兜底，保证无后端时功能可用、可测试。
 */
import type { JournalEntry, Profile } from './index.js'

export interface AiExtraction {
  /** 每条记录提炼出的要点 */
  bullets: string[]
  /** 合并摘要（可作为"成就"保存的正文） */
  summary: string
}

export interface AiMatchItem {
  /** 来源实体 id（经历/项目），用于稳定关联与 v-for key */
  id: string
  title: string
  subtitle: string
  /** 0–100：与 JD 关键词重合度 */
  score: number
}

export interface AiMatch {
  /** 0–100 综合匹配分 */
  score: number
  /** JD 关键词中档案已覆盖的 */
  matched: string[]
  /** JD 关键词中档案未覆盖的（短板） */
  missing: string[]
  /** 经历/项目逐条得分 */
  byItem: AiMatchItem[]
  /** 定制化 summary 建议 */
  summarySuggestion: string
}

export interface AiPolish {
  /** 润色后的文本 */
  text: string
  /** 润色建议（逐条） */
  suggestions: string[]
}

/* ── 内置常见技能/领域词（JD 关键词池的一部分，可继续扩充） ── */
const COMMON_TERMS = [
  'Web安全', '渗透测试', '安全测试', '红队', '蓝队', '代码审计', 'SDL', '应急响应', '威胁建模',
  '注入', 'XSS', 'CSRF', 'SSRF', 'RCE', '越权', '漏洞', 'Burp', 'Nmap', 'Sqlmap',
  '前端', '后端', '全栈', 'JavaScript', 'JS', 'TypeScript', 'Vue', 'React', 'Node', 'CSS', 'DOM', '浏览器',
  'Python', 'Go', 'Java', 'C++', 'SQL', 'Linux', 'Docker', 'Kubernetes', '云原生', 'CI/CD',
  '算法', '数据结构', '分布式', '高并发', '缓存', '消息队列', '数据库', 'MySQL', 'Redis',
  '逆向', '二进制', '分析', '研究', '工程', '测试', '实习',
]

/** 从档案构建技能词表（技能名 + 标签 + 常见词） */
function buildLexicon(profile: Profile): Set<string> {
  const terms = new Set<string>(COMMON_TERMS)
  for (const s of profile.skills) {
    terms.add(s.name)
    for (const t of s.tags) terms.add(t)
  }
  for (const p of profile.projects) {
    for (const t of p.tags) terms.add(t)
  }
  for (const e of profile.experiences) {
    for (const t of e.tags) terms.add(t)
  }
  return terms
}

/** 判断文本是否包含某词（兼容中英文大小写） */
function includesTerm(text: string, term: string): boolean {
  const lower = text.toLowerCase()
  const t = term.toLowerCase()
  return lower.includes(t)
}

/** 从 JD 中提取命中的词表关键词（用于 matched/missing 分类） */
export function extractJdKeywords(jd: string, lexicon: Set<string>): string[] {
  const hit = new Set<string>()
  for (const term of lexicon) {
    if (term.length < 2) continue
    if (includesTerm(jd, term)) hit.add(term)
  }
  return [...hit]
}

/** 单条经历/项目与 JD 的重合度（0–100） */
function itemScore(text: string, jdKeywords: string[]): number {
  if (!jdKeywords.length) return 0
  const hit = jdKeywords.filter((k) => includesTerm(text, k)).length
  return Math.round((hit / jdKeywords.length) * 100)
}

/** JD 语义匹配（E2）—— 本地关键词打分版 */
export function matchJdToProfile(jd: string, profile: Profile): AiMatch {
  const lexicon = buildLexicon(profile)
  const jdKeywords = extractJdKeywords(jd, lexicon)

  const covered = new Set<string>()
  for (const s of profile.skills) {
    covered.add(s.name)
    for (const t of s.tags) covered.add(t)
  }
  for (const e of profile.experiences) for (const t of e.tags) covered.add(t)
  for (const p of profile.projects) for (const t of p.tags) covered.add(t)

  /** 关键词是否在技能名/标签/经历与项目描述中出现（子串匹配，不只是精确覆盖） */
  const coveredByText = (k: string): boolean =>
    profile.skills.some((s) => includesTerm(s.name, k) || s.tags.some((t) => includesTerm(t, k))) ||
    profile.experiences.some((e) => includesTerm(`${e.role} ${e.description_md} ${e.tags.join(' ')}`, k)) ||
    profile.projects.some((p) => includesTerm(`${p.name} ${p.description_md} ${p.summary ?? ''} ${p.tags.join(' ')}`, k))

  const matched = jdKeywords.filter((k) => covered.has(k) || coveredByText(k))
  const missing = jdKeywords.filter((k) => !matched.includes(k))

  const byItem: AiMatchItem[] = []
  for (const e of profile.experiences) {
    byItem.push({
      id: e.id,
      title: e.role,
      subtitle: e.company ?? '',
      score: itemScore(`${e.role} ${e.description_md} ${e.tags.join(' ')}`, jdKeywords),
    })
  }
  for (const p of profile.projects) {
    byItem.push({
      id: p.id,
      title: p.name,
      subtitle: p.summary ?? '',
      score: itemScore(`${p.name} ${p.description_md} ${p.tags.join(' ')}`, jdKeywords),
    })
  }
  byItem.sort((a, b) => b.score - a.score)

  const total = jdKeywords.length
  const score = total ? Math.round((matched.length / total) * 100) : 0
  const summarySuggestion = total
    ? `匹配到 ${matched.length}/${total} 项 JD 关键词（${matched.slice(0, 6).join('、') || '—'}），` +
      (missing.length ? `简历可再强调「${missing.slice(0, 4).join('、')}」相关经历。` : '整体覆盖良好。')
    : 'JD 关键词较少，建议补充完整岗位描述以获得更准匹配。'

  return { score, matched, missing, byItem, summarySuggestion }
}

/** 素材提炼（A3 / E2）—— 将零散日记/记录提炼为结构化要点 */
export function extractHighlights(journals: JournalEntry[]): AiExtraction {
  const bullets: string[] = []
  for (const entry of journals) {
    // 防御：坏数据（缺字段的条目）宁可跳过，不抛 TypeError
    const title = entry.title?.trim?.() ?? ''
    const body = String(entry.content_md ?? '')
      .replace(/[#>*`_~\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const firstSentence = body.split(/[。！？.!?]/)[0]?.trim() ?? ''
    const snippet = firstSentence || body.slice(0, 40)
    if (title || snippet) {
      bullets.push(title ? `${title}：${snippet}` : snippet)
    }
  }
  // 合并摘要：取前 3 条要点拼接为一句可入库"成就"的话
  const summary =
    bullets.length > 1
      ? `${bullets[0]}；${bullets[1]}${bullets[2] ? `；${bullets[2]}` : ''}。`
      : bullets[0] ?? ''
  return { bullets, summary }
}

/** 简历润色（B3 / E2）—— 本地版：规范化格式 + 补充 JD 关键词提示 */
export function polishResume(text: string, jd?: string): AiPolish {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.replace(/\s{2,}/g, ' ').replace(/\t+/g, ' ').trim()) // 段落内多余空格/制表符归一
    .filter(Boolean)
  const cleaned = paragraphs.join('\n')

  const suggestions: string[] = []
  if (!text.trim()) {
    suggestions.push('输入为空，请先粘贴简历正文')
  }
  if (text.includes('  ') || text.includes('\t')) {
    suggestions.push('已清理多余空格与制表符，统一段落格式')
  }
  if (paragraphs.length > 1) {
    suggestions.push(`检测到 ${paragraphs.length} 个段落，已按空行分段归一`)
  }
  if (jd) {
    const lexicon = new Set<string>(COMMON_TERMS)
    const hit = new Set<string>()
    for (const term of lexicon) {
      if (term.length < 2) continue
      if (includesTerm(jd, term)) hit.add(term)
    }
    const coveredInResume = [...hit].filter((k) => includesTerm(text, k))
    const uncovered = [...hit].filter((k) => !includesTerm(text, k))
    if (uncovered.length) {
      suggestions.push(`JD 出现但简历未覆盖的关键词：${uncovered.slice(0, 8).join('、')}，建议在经历中显式体现`)
    } else if (coveredInResume.length) {
      suggestions.push(`已覆盖 JD 全部 ${coveredInResume.length} 项检测到关键词`)
    }
  }

  return { text: cleaned, suggestions }
}

/** B3 特化简历草稿：按 JD 匹配度重排经历 + 生成定制 summary */
export function buildResumeDraft(
  profile: Profile,
  jd: string,
): { markdown: string; summary: string } {
  const match = matchJdToProfile(jd, profile)
  // 组合 summary：匹配建议 + 原档案简介（写入 markdown 与返回值）
  const summary =
    match.summarySuggestion + (profile.summary ? `\n${profile.summary}` : '')

  const skills = [...profile.skills]
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
    .map((s) => s.name)
  const skillLine = skills.length ? `**技能**：${skills.join('、')}\n` : ''

  // 按来源 id 稳定关联得分（同名岗位/项目不串分）
  const scoreById = new Map(match.byItem.map((i) => [i.id, i.score]))
  const experiences = profile.experiences
    .map((e) => ({ ...e, score: scoreById.get(e.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
  const experienceLines = experiences
    .map((e) => {
      const period = e.start_date ? `${e.start_date}${e.end_date ? ` ~ ${e.end_date}` : ''}` : ''
      const header = [`### ${e.role}${e.company ? ` · ${e.company}` : ''}`, period].filter(Boolean).join('\n')
      return `${header}\n${e.description_md || ''}`
    })
    .join('\n\n')

  const projects = profile.projects
    .map((p) => ({ ...p, score: scoreById.get(p.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
  const projectLines = projects
    .map((p) => `### ${p.name}\n${p.description_md || p.summary || ''}`)
    .join('\n\n')

  const education = profile.education
    .map((ed) => {
      const degree = [ed.degree, ed.major].filter(Boolean).join(' · ')
      return `### ${ed.school}${degree ? `\n${degree}` : ''}`
    })
    .join('\n\n')

  const markdown = [
    `# ${profile.full_name}`,
    profile.headline ? `> ${profile.headline}` : '',
    '',
    `**意向岗位**：${jd.slice(0, 80)}`,
    '',
    skillLine,
    '## 个人简介',
    summary,
    '',
    experienceLines ? `## 工作经历\n\n${experienceLines}` : '',
    projectLines ? `## 项目经历\n\n${projectLines}` : '',
    education ? `## 教育背景\n\n${education}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { markdown, summary }
}

