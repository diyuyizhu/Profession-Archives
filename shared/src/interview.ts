/**
 * 面试领域聚合（C1 轮次 / C2 状态流转 / C4 题库分组 共用）。
 * 纯函数，无副作用 —— 前端 localStorage 版与 server 版均引用。
 */
import type {
  ApplicationStatus,
  Interview,
  InterviewResult,
  QuestionBankItem,
} from './index.js'
import { isTerminal, nextStage } from './application.js'
import { MAX_ROUNDS } from './index.js'

/**
 * C2 状态流转：单轮面试结果 → 投递状态变更。
 * - passed  → 推进一级（已到投递的最后一轮则视为 Offer）
 * - failed  → 拒绝
 * - pending → 不动（返回 null）
 * - 已是终态 → 不动（终态是吸收态，任何面试结果都不再改写看板）
 * 由 store 在记录面试后执行，保证看板实时推进。totalRounds 决定哪一轮是最后一面。
 */
export function applyInterviewResult(
  current: ApplicationStatus,
  result: InterviewResult,
  totalRounds = MAX_ROUNDS,
): ApplicationStatus | null {
  if (isTerminal(current)) return null
  if (result === 'passed') return nextStage(current, totalRounds) ?? 'offer'
  if (result === 'failed') return 'rejected'
  return null
}

/** 某投递下一轮的序号（现有最大轮次 + 1，无则 1；不超过 MAX_ROUNDS 上限） */
export function nextRoundNumber(interviews: Interview[], applicationId: string): number {
  const rounds = interviews
    .filter((i) => i.application_id === applicationId)
    .map((i) => i.round)
  const next = rounds.length ? Math.max(...rounds) + 1 : 1
  return Math.min(next, MAX_ROUNDS)
}

/** 题库按分类分组（未分类归入「未分类」），类内按创建时间倒序 */
export function groupQuestionsByCategory(
  items: QuestionBankItem[],
): Array<{ category: string; items: QuestionBankItem[] }> {
  const map = new Map<string, QuestionBankItem[]>()
  for (const item of items) {
    const category = item.category?.trim() || '未分类'
    const list = map.get(category)
    if (list) list.push(item)
    else map.set(category, [item])
  }
  return [...map.entries()]
    .map(([category, list]) => ({
      category,
      items: [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'))
}

/**
 * 本地启发式复盘（C3 兜底）：无 AI 后端时从面试记录生成复盘要点。
 * 规则简单、可解释：通过/高自评 → 亮点；淘汰/低自评 → 待改进（附题目）；
 * 待定 → 等待策略。接入后端 AI（模块 E）后由真实模型替换。
 */
export function buildLocalReflection(
  interviews: Interview[],
  meta: { company?: string; title?: string },
): { highlights: string[]; improvements: string[]; next_strategy: string[]; content_md: string } {
  const sorted = [...interviews].sort((a, b) => a.round - b.round)
  const highlights: string[] = []
  const improvements: string[] = []
  const strategy: string[] = []

  const passed = sorted.filter((i) => i.result === 'passed')
  const failed = sorted.filter((i) => i.result === 'failed')
  const pending = sorted.filter((i) => i.result === 'pending')
  const lowScore = sorted.filter((i) => i.self_rating <= 2)

  for (const i of passed) {
    highlights.push(`第 ${i.round} 轮通过（自评 ${i.self_rating}/5）`)
  }
  if (passed.length && passed.length === sorted.length) {
    highlights.push('全流程通过，面试表现稳定')
  }
  for (const i of failed) {
    improvements.push(`第 ${i.round} 轮未通过，重点复盘该轮`)
  }
  for (const i of lowScore) {
    improvements.push(`第 ${i.round} 轮自评偏低（${i.self_rating}/5），需针对性提升`)
  }

  // 从题目中提取薄弱主题（分类关键词）
  const questions = collectQuestions(sorted)
  const categoryHits = new Map<string, number>()
  const categoryKeywords = new Map<string, string[]>([
    ['算法', ['算法', '排序', '复杂度', 'DP', '动态规划', '链表', '二叉树', '递归']],
    ['前端', ['前端', 'Vue', 'React', '浏览器', 'CSS', 'DOM', '跨域']],
    ['网络安全', ['注入', 'XSS', 'CSRF', '渗透', 'Burp', 'SSRF', 'RCE', '越权', '漏洞']],
    ['系统设计', ['系统设计', '架构', '分布式', '高并发', '缓存', '消息队列']],
    ['项目经历', ['项目', '难点', '收益', '复盘']],
  ])
  for (const { question } of questions) {
    for (const [cat, kws] of categoryKeywords) {
      if (kws.some((k) => question.includes(k))) {
        categoryHits.set(cat, (categoryHits.get(cat) ?? 0) + 1)
      }
    }
  }
  const weakCats = [...categoryHits.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat)
  for (const cat of weakCats) {
    improvements.push(`「${cat}」类问题多次出现，建议专项复习`)
  }

  if (pending.length) {
    strategy.push(`第 ${pending.map((p) => p.round).join('、')} 轮结果待定，保持跟进`)
  }
  if (weakCats.length) {
    strategy.push(`优先补足：${weakCats.join(' / ')}`)
  }
  if (!strategy.length) {
    strategy.push('梳理全流程，准备下一轮或跟进 Offer')
  }

  const lines = [
    ...sorted.map((i) => {
      const qa = i.qa.map((q) => `- 问：${q.question}${q.answer ? `\n  答：${q.answer}` : ''}`).join('\n')
      return `### 第 ${i.round} 轮（${i.occurred_at} · ${i.interview_type}）\n${qa || '（无题目记录）'}`
    }),
    '',
    `> 本地启发式复盘 · 接入 AI 后自动升级`,
  ]
  const content_md = [`# ${meta.title ?? ''}${meta.company ? ` · ${meta.company}` : ''} 复盘`, '', ...lines].join('\n')

  return { highlights, improvements, next_strategy: strategy, content_md }
}

/** 按题目关键词分类（C4 沉淀 / 复盘薄弱方向共用同一套方向） */
const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  ['网络安全', ['注入', 'XSS', 'CSRF', 'SSRF', 'RCE', '越权', '漏洞', '渗透', 'Burp', '安全', '绕过', '加固']],
  ['前端', ['前端', 'Vue', 'React', '浏览器', 'CSS', 'DOM', '跨域', '渲染', '性能']],
  ['算法', ['算法', '排序', '复杂度', 'DP', '动态规划', '链表', '二叉树', '递归', '哈希']],
  ['系统设计', ['系统设计', '架构', '分布式', '高并发', '缓存', '消息队列', '微服务']],
  ['项目经历', ['项目', '难点', '收益', '复盘', '亮点']],
]

/** 题目 → 方向分类（无命中归「其他」） */
export function classifyQuestionCategory(question: string): string {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => question.includes(k))) return category
  }
  return '其他'
}

/** 从面试记录中收集题目（去重，按出现次数倒序）—— 供 C4 沉淀与复盘引用 */
export function collectQuestions(
  interviews: Interview[],
  max = 50,
): Array<{ question: string; count: number }> {
  const map = new Map<string, number>()
  for (const interview of interviews) {
    for (const qa of interview.qa) {
      const q = qa.question.trim()
      if (!q) continue
      map.set(q, (map.get(q) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count || a.question.localeCompare(b.question, 'zh-CN'))
    .slice(0, max)
}
