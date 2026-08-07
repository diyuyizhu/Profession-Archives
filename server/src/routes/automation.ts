/**
 * 浏览器插件本地桥（模块 D）：岗位采集入库 / 档案读取 / 投递回传 / 字段映射记忆。
 * 全部要求配对 token（preHandler），CORS 白名单仅放行扩展 origin。
 */
import crypto from 'node:crypto'

import type { FastifyInstance } from 'fastify'

import { canTransition, isValidStatus } from '@pa/shared/application'

import { db } from '../db.js'
import { requirePairing } from '../plugins/auth.js'

export function registerAutomationRoutes(app: FastifyInstance): void {
  // 插件读取当前档案（供表单填充）
  app.get('/api/automation/profile', { preHandler: requirePairing }, async () => {
    const profile = db
      .prepare('SELECT id, full_name, headline, email, phone, summary FROM profiles ORDER BY updated_at DESC LIMIT 1')
      .get() as { full_name: string; headline: string | null; email: string | null; phone: string | null; summary: string | null } | undefined
    if (!profile) return { ok: true, profile: null }
    return {
      ok: true,
      profile: {
        full_name: profile.full_name,
        headline: profile.headline ?? undefined,
        email: profile.email ?? undefined,
        phone: profile.phone ?? undefined,
        summary: profile.summary ?? undefined,
      },
    }
  })

  // 插件采集岗位 → 看板备选池
  app.post('/api/automation/job', { preHandler: requirePairing }, async (request, reply) => {
    const b = (request.body ?? {}) as {
      company?: string
      title?: string
      jd?: string
      url?: string
      channel?: string
      tags?: string[]
      snapshot?: string
    }
    if (!b.company?.trim() || !b.title?.trim()) {
      return reply.code(400).send({ error: '需提供 company 与 title' })
    }
    const id = crypto.randomUUID()
    const ts = new Date().toISOString()
    db.prepare(
      `INSERT INTO applications
        (id, company, title, url, jd, channel, status, tags_json, applied_at, created_at, updated_at)
       VALUES (@id, @company, @title, @url, @jd, @channel, 'backlog', @tags, NULL, @ts, @ts)`,
    ).run({
      id,
      company: b.company.trim(),
      title: b.title.trim(),
      url: b.url?.trim() || null,
      jd: b.jd?.trim() || null,
      channel: b.channel?.trim() || null,
      tags: JSON.stringify(b.tags ?? []),
      ts,
    })
    return { ok: true, id }
  })

  // 投递结果回传（更新看板状态 + 事件日志）
  app.post('/api/automation/application', { preHandler: requirePairing }, async (request, reply) => {
    const b = (request.body ?? {}) as {
      applicationId?: string
      company?: string
      title?: string
      status?: string
      appliedAt?: string
      note?: string
    }
    const status = b.status ?? 'applied'
    // 状态合法 + 与共享状态机一致（round_1..round_8 + 固定阶段）
    if (!isValidStatus(status)) {
      return reply.code(400).send({ error: `未知状态：${status}` })
    }

    let row: { id: string; status: string } | undefined
    if (b.applicationId) {
      row = db.prepare('SELECT id, status FROM applications WHERE id = ?').get(b.applicationId) as
        | { id: string; status: string }
        | undefined
    } else if (b.company && b.title) {
      row = db.prepare('SELECT id, status FROM applications WHERE company = ? AND title = ? ORDER BY created_at DESC LIMIT 1').get(b.company, b.title) as
        | { id: string; status: string }
        | undefined
    }
    if (!row) return reply.code(404).send({ error: '未找到对应投递（可先 POST /api/automation/job 采集）' })

    // 状态机校验：只允许前进 / 到终态（与前端看板一致，防止事件轨迹被回退污染漏斗）
    if (!canTransition(row.status as never, status as never)) {
      return reply.code(400).send({ error: `非法状态迁移：${row.status} → ${status}` })
    }

    db.prepare('UPDATE applications SET status = ?, applied_at = COALESCE(?, applied_at), updated_at = ? WHERE id = ?').run(
      status,
      b.appliedAt ?? null,
      new Date().toISOString(),
      row.id,
    )
    db.prepare(
      'INSERT INTO application_events (id, application_id, from_status, to_status, at, note) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), row.id, row.status, status, new Date().toISOString(), b.note ?? null)
    return { ok: true, id: row.id }
  })

  // 站点字段映射：查询（per-origin）
  app.get('/api/automation/form-mapping', { preHandler: requirePairing }, async (request, reply) => {
    const origin = (request.query as { origin?: string }).origin
    if (!origin) return reply.code(400).send({ error: '需提供 ?origin=' })
    const rows = db.prepare('SELECT * FROM form_mappings WHERE origin = ?').all(origin)
    return { ok: true, mappings: rows }
  })

  // 站点字段映射：上报（记忆）
  app.post('/api/automation/form-mapping', { preHandler: requirePairing }, async (request, reply) => {
    const b = (request.body ?? {}) as {
      origin?: string
      field_key?: string
      field_label?: string
      control_type?: string
      target_field?: string
    }
    if (!b.origin || !b.field_key || !b.target_field) {
      return reply.code(400).send({ error: '需提供 origin / field_key / target_field' })
    }
    db.prepare(
      `INSERT INTO form_mappings (id, origin, field_key, field_label, control_type, target_field, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(origin, field_key) DO UPDATE SET
         field_label=excluded.field_label, control_type=excluded.control_type,
         target_field=excluded.target_field, updated_at=excluded.updated_at`,
    ).run(
      crypto.randomUUID(),
      b.origin,
      b.field_key,
      b.field_label ?? null,
      b.control_type ?? null,
      b.target_field,
      new Date().toISOString(),
    )
    return { ok: true }
  })
}
