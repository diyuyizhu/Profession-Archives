/**
 * 档案领域聚合（A2 聚合名片 / A4 时间线 / A5 名片页 共用）。
 * 纯函数，无副作用 —— 前端 localStorage 版与 server 版均引用。
 */
import type { CareerCardData, JournalEntry, Profile, TimelineItem } from './index.js'

/** 时间线端点：经历 / 教育 / 项目取 start_date（无则跳过），里程碑取 occurred_at */
export function buildTimeline(profile: Profile): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const exp of profile.experiences) {
    if (!exp.start_date) continue
    items.push({
      kind: 'experience',
      title: exp.role,
      subtitle: exp.company,
      date: exp.start_date,
      tags: exp.tags,
      snippet: snippetOf(exp.description_md),
    })
  }

  for (const edu of profile.education) {
    if (!edu.start_date) continue
    items.push({
      kind: 'education',
      title: edu.school,
      subtitle: [edu.degree, edu.major].filter(Boolean).join(' · '),
      date: edu.start_date,
      tags: [],
      snippet: edu.description ?? '',
    })
  }

  for (const project of profile.projects) {
    if (!project.start_date) continue
    items.push({
      kind: 'project',
      title: project.name,
      subtitle: project.summary,
      date: project.start_date,
      tags: project.tags,
      snippet: snippetOf(project.description_md),
    })
  }

  for (const entry of profile.journal) {
    if (entry.entry_type !== 'milestone') continue
    items.push({
      kind: 'milestone',
      title: entry.title,
      date: entry.occurred_at,
      tags: entry.tags,
      snippet: snippetOf(entry.content_md),
    })
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** 正文摘要：去 Markdown 符号，截断到 ~60 字 */
export function snippetOf(md: string, max = 60): string {
  const text = md
    .replace(/[#>*`_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 聚合名片（A2 / A5 数据源） */
export function buildCareerCard(profile: Profile): CareerCardData {
  const journalByType: CareerCardData['journalByType'] = {
    journal: [],
    achievement: [],
    milestone: [],
  }
  for (const entry of profile.journal) {
    journalByType[entry.entry_type]?.push(entry)
  }

  const tagCount = new Map<string, number>()
  const bump = (tags: string[]) => {
    for (const tag of tags) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1)
    }
  }
  profile.skills.forEach((s) => bump(s.tags))
  profile.experiences.forEach((e) => bump(e.tags))
  profile.projects.forEach((p) => bump(p.tags))
  profile.journal.forEach((j) => bump(j.tags))

  const tagCloud = [...tagCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const usable = [...profile.journal].filter((e) => e.entry_type === 'achievement' || e.title || e.content_md)

  return {
    profile,
    journalByType,
    tagCloud,
    timeline: buildTimeline(profile),
    materialCount: usable.length,
  }
}

/** 标签去重合并（输入多个标签数组） */
export function mergeTags(...groups: string[][]): string[] {
  return [...new Set(groups.flat().filter(Boolean))]
}
