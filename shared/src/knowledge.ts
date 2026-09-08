/**
 * 知识积累文档领域（新增模块 K）：Markdown 知识库。
 * 纯函数，无副作用 —— 前端 localStorage 版。
 * 与 journal（日记/成就/里程碑碎片）的区别：知识库沉淀"可复用的长期知识"，
 * 支持文档化（标题+Markdown 正文）、标签、分组、全文搜索。
 */

/** 知识文档 */
export interface KnowledgeDoc {
  id: string
  /** 标题 */
  title: string
  /** Markdown 正文 */
  content_md: string
  /** 标签 */
  tags: string[]
  /** 分组（用户自定义维度，如 面经整理/学习笔记/技术方案） */
  group?: string
  /** 关联投递（可选，从投递详情沉淀而来） */
  application_id?: string
  created_at: string
  updated_at: string
}

/** 创建/更新载荷 */
export type KnowledgePayload = Omit<KnowledgeDoc, 'id' | 'created_at' | 'updated_at'>

/** 全文搜索：标题/正文/标签中匹配关键词（不区分大小写，多词 AND） */
export function searchKnowledge(
  docs: KnowledgeDoc[],
  query: string,
): KnowledgeDoc[] {
  const q = query.trim().toLowerCase()
  if (!q) return docs
  const terms = q.split(/\s+/).filter(Boolean)
  return docs.filter((doc) => {
    const hay = `${doc.title} ${doc.content_md} ${doc.tags.join(' ')} ${doc.group ?? ''}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

/** 按分组聚合（未分组归「未分组」），组内按更新时间倒序 */
export function groupByDoc(docs: KnowledgeDoc[]): Array<{ group: string; docs: KnowledgeDoc[] }> {
  const map = new Map<string, KnowledgeDoc[]>()
  for (const doc of docs) {
    const group = doc.group?.trim() || '未分组'
    const list = map.get(group)
    if (list) list.push(doc)
    else map.set(group, [doc])
  }
  return [...map.entries()]
    .map(([group, list]) => ({
      group,
      docs: [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group, 'zh-CN'))
}

/** 全部标签（去重排序） */
export function allKnowledgeTags(docs: KnowledgeDoc[]): string[] {
  const set = new Set<string>()
  for (const doc of docs) for (const t of doc.tags) if (t) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/** 按标签过滤（空集合 = 不限） */
export function filterByTags(docs: KnowledgeDoc[], tags: Set<string>): KnowledgeDoc[] {
  if (!tags.size) return docs
  return docs.filter((doc) => doc.tags.some((t) => tags.has(t)))
}

/** Markdown → 纯文本摘要（去标记符号，取前 N 字） */
export function knowledgeSummary(md: string, max = 80): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/[#>*`_~\-]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}
