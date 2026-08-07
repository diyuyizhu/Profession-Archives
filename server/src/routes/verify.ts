/**
 * 原子档案可信认证（服务端·面向招聘方）：
 * 给招聘方验证面试人经历的真实性与时间戳 —— 只比对哈希，不泄露明文。
 *
 * 隐私授权流程（对应商业化"经历区块链存证"）：
 *   1. 用户（面试人）在应用内"授权生成验证链接"（带配对 token）
 *   2. 服务端对该经历内容算 SHA-256 并落库存证（附时间戳；TODO：接入备案存证平台上链）
 *   3. 生成验证引用发给招聘方
 *   4. 招聘方上传经历原文 → 本地算哈希 → 与存证比对 → 返回 完整/未篡改/存证时刻 或 不匹配
 */
import crypto from 'node:crypto'

import type { FastifyInstance } from 'fastify'

import { db } from '../db.js'
import { requirePairing } from '../plugins/auth.js'

interface AttestBody {
  /** 档案 id（用户授权时校验） */
  profileId?: string
  items?: Array<{ id: string; label?: string; content: string }>
}

export function registerVerifyRoutes(app: FastifyInstance): void {
  // 存证（需个人授权 + 配对 token）：给经历生成哈希存证
  app.post('/api/verify/attest', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as AttestBody
    if (!body.profileId || !Array.isArray(body.items) || !body.items.length) {
      return reply.code(400).send({ error: '需提供 profileId 与待存证经历条目（id + content）' })
    }
    const notBefore = new Date().toISOString()
    const attestations = body.items.map((item) => {
      if (typeof item.content !== 'string' || !item.content.trim()) {
        throw new Error('经历内容不能为空')
      }
      const sha256 = crypto.createHash('sha256').update(item.content).digest('hex')
      db.prepare(
        `INSERT INTO attestations (id, profile_id, item_id, item_label, sha256, not_before, tx)
         VALUES (@id, @profileId, @itemId, @label, @sha256, @notBefore, @tx)
         ON CONFLICT(profile_id, item_id) DO UPDATE SET
           sha256=@sha256, not_before=@notBefore, item_label=@label, tx=@tx`,
      ).run({
        id: crypto.randomUUID(),
        profileId: body.profileId,
        itemId: item.id,
        label: item.label ?? null,
        sha256,
        notBefore,
        // TODO：接入备案存证平台上链后替换为链上交易号
        tx: 'pending-blockchain-attestation',
      })
      return { itemId: item.id, sha256, notBefore, verifyUrl: '/api/verify/check' }
    })
    return { ok: true, attestations }
  })

  // 招聘方验证（无需配对 token）：上传经历原文 → 算哈希 → 与存证比对
  app.post('/api/verify/check', async (request, reply) => {
    const body = (request.body ?? {}) as { itemId?: string; content?: string }
    if (!body.itemId || typeof body.content !== 'string' || !body.content.trim()) {
      return reply.code(400).send({ error: '需提供 itemId 与经历原文' })
    }
    const record = db
      .prepare('SELECT * FROM attestations WHERE item_id = ?')
      .get(body.itemId) as { sha256: string; not_before: string; item_label?: string } | undefined
    if (!record) {
      return reply.code(404).send({ ok: false, error: '未找到该经历的存证记录（可能未授权生成）' })
    }
    const hash = crypto.createHash('sha256').update(body.content).digest('hex')
    const match = hash === record.sha256
    return {
      ok: match,
      result: match
        ? `✓ 完整、未篡改 · 存证于 ${record.not_before}`
        : '✗ 内容与存证不一致（可能被修改）',
      notBefore: match ? record.not_before : undefined,
      // 隐私：只返回比对结果，绝不返回原文，也不返回标签等元信息
    }
  })
}
