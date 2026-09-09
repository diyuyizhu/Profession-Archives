/**
 * 文件文本提取（档案导入）：DOCX（mammoth）/ PDF（pdf-parse）→ 纯文本。
 * POST /api/import/extract-text { filename, content_base64 } → { text }
 * 前端 DOCX 有零依赖兜底；PDF 必须经本端点（中文字体 CID 编码无法可靠前端解析）。
 *
 * ⚠️ 桌面端（打包版）跑的不是本文件：Tauri 进程内不启动 Node，实际由 Rust 侧
 * `src-tauri/src/import.rs` 实现同一路由（pdf-extract / zip + XML）。
 * 改这里时请同步改那边，并保持请求/响应结构一致（{ ok, text } / { error }）。
 * 已知差异：Fastify 默认 bodyLimit 为 1MB，故下面 20MB 上限在本路由实际不可达；
 * Rust 侧按 20MB 生效。
 */
import type { FastifyInstance } from 'fastify'

import { requirePairing } from '../plugins/auth.js'

export function registerImportRoutes(app: FastifyInstance): void {
  app.post('/api/import/extract-text', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { filename?: string; content_base64?: string }
    const filename = (body.filename ?? '').toLowerCase()
    const b64 = body.content_base64 ?? ''
    if (!b64) return reply.code(400).send({ error: '需提供 content_base64' })

    let buffer: Buffer
    try {
      buffer = Buffer.from(b64, 'base64')
    } catch {
      return reply.code(400).send({ error: 'content_base64 非法' })
    }
    if (buffer.length > 20 * 1024 * 1024) {
      return reply.code(413).send({ error: '文件超过 20MB 上限' })
    }

    try {
      if (filename.endsWith('.pdf')) {
        // 注意：pdf-parse 主入口带调试副作用，须引内部模块
        const mod = (await import('pdf-parse/lib/pdf-parse.js')) as unknown as {
          default: (b: Buffer) => Promise<{ text: string }>
        }
        const data = await mod.default(buffer)
        const text = (data.text ?? '').replace(/\r/g, '').trim()
        if (!text) return reply.code(422).send({ error: 'PDF 未提取到文本（可能是扫描件/纯图片）' })
        return { ok: true, text }
      }
      if (filename.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const data = await mammoth.extractRawText({ buffer })
        const text = (data.value ?? '').trim()
        if (!text) return reply.code(422).send({ error: 'DOCX 未提取到文本' })
        return { ok: true, text }
      }
      if (filename.endsWith('.doc')) {
        return reply.code(415).send({ error: '旧版 .doc 不支持，请另存为 .docx' })
      }
      return reply.code(415).send({ error: '仅支持 .pdf / .docx' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(502).send({ error: `解析失败：${msg.slice(0, 200)}` })
    }
  })
}
