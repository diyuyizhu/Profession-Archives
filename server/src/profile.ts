/**
 * 档案领域（模块 A）：repository + service 合并实现。
 * 与前端 localStorage 版共用 @pa/shared 契约，序列化字段一一对应。
 */
import { randomUUID } from 'node:crypto'
import type { Education, Experience, JournalEntry, Profile, ProfilePayload, Project, Skill } from '@pa/shared'
import { db } from './db.js'

const now = () => new Date().toISOString()

interface ProfileRow {
  id: string
  full_name: string
  headline: string | null
  email: string | null
  phone: string | null
  summary: string | null
  card_theme: string
  created_at: string
  updated_at: string
}

function parseJson(raw: string | null, fallback: unknown[] = []): unknown[] {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as unknown[]
  } catch {
    return fallback
  }
}

/** 行类型守卫：better-sqlite3 返回 unknown[]，这里收窄为记录 */
function isRow(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function getProfile(profileId: string): Profile | null {
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as ProfileRow | undefined
  if (!row) return null

  const skills = db
    .prepare('SELECT * FROM skills WHERE profile_id = ? ORDER BY sort_order, name')
    .all(profileId) as unknown[]
  const experiences = db
    .prepare('SELECT * FROM experiences WHERE profile_id = ? ORDER BY sort_order, start_date DESC')
    .all(profileId) as unknown[]
  const education = db
    .prepare('SELECT * FROM education WHERE profile_id = ? ORDER BY sort_order')
    .all(profileId) as unknown[]
  const projects = db
    .prepare('SELECT * FROM projects WHERE profile_id = ? ORDER BY sort_order')
    .all(profileId) as unknown[]
  const journal = db
    .prepare('SELECT * FROM journal_entries WHERE profile_id = ? ORDER BY occurred_at DESC, created_at DESC')
    .all(profileId) as unknown[]

  const mapSkill = (r: Record<string, unknown>): Skill => ({
    id: r.id as string,
    name: r.name as string,
    category: (r.category as string | null) ?? undefined,
    level: (r.level as number | null) ?? undefined,
    tags: parseJson(r.tags_json as string) as string[],
  })
  const mapExperience = (r: Record<string, unknown>): Experience => ({
    id: r.id as string,
    role: r.role as string,
    company: (r.company as string | null) ?? undefined,
    description_md: r.description_md as string,
    tags: parseJson(r.tags_json as string) as string[],
    start_date: (r.start_date as string | null) ?? undefined,
    end_date: (r.end_date as string | null) ?? undefined,
  })
  const mapEducation = (r: Record<string, unknown>): Education => ({
    id: r.id as string,
    school: r.school as string,
    degree: (r.degree as string | null) ?? undefined,
    major: (r.major as string | null) ?? undefined,
    start_date: (r.start_date as string | null) ?? undefined,
    end_date: (r.end_date as string | null) ?? undefined,
    description: (r.description as string | null) ?? undefined,
  })
  const mapProject = (r: Record<string, unknown>): Project => ({
    id: r.id as string,
    name: r.name as string,
    summary: (r.summary as string | null) ?? undefined,
    description_md: r.description_md as string,
    tags: parseJson(r.tags_json as string) as string[],
    attachments: parseJson(r.attachments_json as string) as string[],
    start_date: (r.start_date as string | null) ?? undefined,
    end_date: (r.end_date as string | null) ?? undefined,
  })
  const mapJournal = (r: Record<string, unknown>): JournalEntry => ({
    id: r.id as string,
    entry_type: r.entry_type as JournalEntry['entry_type'],
    title: r.title as string,
    content_md: r.content_md as string,
    occurred_at: r.occurred_at as string,
    tags: parseJson(r.tags_json as string) as string[],
    attachments: parseJson(r.attachments_json as string) as string[],
    collection_id: (r.collection_id as string | null) ?? undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  })

  return {
    id: row.id,
    full_name: row.full_name,
    headline: row.headline ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    summary: row.summary ?? undefined,
    skills: skills.filter(isRow).map(mapSkill),
    experiences: experiences.filter(isRow).map(mapExperience),
    education: education.filter(isRow).map(mapEducation),
    projects: projects.filter(isRow).map(mapProject),
    journal: journal.filter(isRow).map(mapJournal),
    card_theme: row.card_theme,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function upsertProfile(payload: ProfilePayload): Profile {
  const ts = now()
  // 单档案模式：已存在则"整档案替换"（更新主行 + 删旧子表重插），否则新建。
  // 避免每次 POST 都插入一份新档案导致重复。
  const existing = db.prepare('SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1').get() as
    | { id: string }
    | undefined
  const id = existing?.id ?? randomUUID()
  const isNew = !existing

  const skills = payload.skills ?? []
  const experiences = payload.experiences ?? []
  const education = payload.education ?? []
  const projects = payload.projects ?? []
  const journal = payload.journal ?? []

  const write = db.transaction(() => {
    if (isNew) {
      db.prepare(
        `INSERT INTO profiles (id, full_name, headline, email, phone, summary, card_theme, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, payload.full_name, payload.headline ?? null, payload.email ?? null, payload.phone ?? null, payload.summary ?? null, payload.card_theme ?? 'trae', ts, ts)
    } else {
      db.prepare(
        `UPDATE profiles SET full_name=?, headline=?, email=?, phone=?, summary=?, card_theme=?, updated_at=? WHERE id=?`,
      ).run(payload.full_name, payload.headline ?? null, payload.email ?? null, payload.phone ?? null, payload.summary ?? null, payload.card_theme ?? 'trae', ts, id)
      for (const t of ['skills', 'experiences', 'education', 'projects', 'journal_entries']) {
        db.prepare(`DELETE FROM ${t} WHERE profile_id = ?`).run(id)
      }
    }

    const skillStmt = db.prepare(
      `INSERT INTO skills (id, profile_id, name, category, level, tags_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    skills.forEach((s, i) =>
      skillStmt.run(randomUUID(), id, s.name, s.category ?? null, s.level ?? null, JSON.stringify(s.tags ?? []), i),
    )

    const expStmt = db.prepare(
      `INSERT INTO experiences (id, profile_id, role, company, description_md, tags_json, start_date, end_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    experiences.forEach((e, i) =>
      expStmt.run(randomUUID(), id, e.role, e.company ?? null, e.description_md, JSON.stringify(e.tags ?? []), e.start_date ?? null, e.end_date ?? null, i),
    )

    const eduStmt = db.prepare(
      `INSERT INTO education (id, profile_id, school, degree, major, start_date, end_date, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    education.forEach((e, i) =>
      eduStmt.run(randomUUID(), id, e.school, e.degree ?? null, e.major ?? null, e.start_date ?? null, e.end_date ?? null, e.description ?? null, i),
    )

    const projStmt = db.prepare(
      `INSERT INTO projects (id, profile_id, name, summary, description_md, tags_json, attachments_json, start_date, end_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    projects.forEach((p, i) =>
      projStmt.run(randomUUID(), id, p.name, p.summary ?? null, p.description_md, JSON.stringify(p.tags ?? []), JSON.stringify(p.attachments ?? []), p.start_date ?? null, p.end_date ?? null, i),
    )

    const journalStmt = db.prepare(
      `INSERT INTO journal_entries (id, profile_id, entry_type, title, content_md, occurred_at, tags_json, attachments_json, collection_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    journal.forEach((j) =>
      journalStmt.run(randomUUID(), id, j.entry_type, j.title, j.content_md, j.occurred_at, JSON.stringify(j.tags ?? []), JSON.stringify(j.attachments ?? []), j.collection_id ?? null),
    )
  })
  write()

  return getProfile(id) as Profile
}

export function listProfiles(): Profile[] {
  const rows = db.prepare('SELECT id FROM profiles ORDER BY created_at DESC').all() as Array<{ id: string }>
  return rows.map((r) => getProfile(r.id)).filter((p): p is Profile => p !== null)
}
