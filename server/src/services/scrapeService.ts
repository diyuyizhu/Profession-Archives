/**
 * URL 直采服务（B2）：抓取招聘页面 → 提取标题/公司/JD。
 * 零依赖：Node 内置 fetch + 正则轻量 HTML 提取（og:title / meta description / 正文清洗）。
 * SSRF 防护：仅 https、禁内网/链路本地/云元数据地址。
 */
import type { FastifyInstance } from 'fastify'

import { requirePairing } from '../plugins/auth.js'

/** Endpoint 安全校验（与 aiService 同一套规则；禁止内网探测） */
function assertSafeUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('不是合法 URL')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('仅支持 http/https')
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const unsafe =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^fe80:/.test(host) ||
    /^fd/.test(host) ||
    host === 'metadata.google.internal'
  if (unsafe) throw new Error('不允许抓取本机/内网地址')
  return u
}

/** HTML → 纯文本（去 script/style/标签/多余空白） */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** meta 属性提取（name/property 双支持） */
function metaContent(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`,
    'i',
  )
  const m = html.match(re)
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

/** 公司名启发式（与 AI 兜底同源规则） */
function heuristicCompany(text: string): string {
  const m =
    text.match(/([^，。,;；\s|]{2,20}?(?:公司|集团|科技|网络|软件|数据|实验室|工作室))/) ??
    text.match(/(?:招聘|加入)\s*([^，。,;；\s|]{2,16}?)[，,|\s]/)
  return m?.[1]?.trim() ?? ''
}

export interface ScrapeResult {
  url: string
  title: string
  company: string
  jd: string
}

/** 抓取并解析招聘页面（15s 超时） */
export async function scrapeJobPage(rawUrl: string): Promise<ScrapeResult> {
  const u = assertSafeUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`抓取失败：HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
      throw new Error(`页面不是 HTML（${contentType.split(';')[0]}）`)
    }
    const html = (await res.text()).slice(0, 500_000)

    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''
    const ogTitle = metaContent(html, 'og:title')
    const title = (ogTitle || titleTag).replace(/\s+/g, ' ').slice(0, 120)

    const description = metaContent(html, 'og:description') || metaContent(html, 'description')
    const bodyText = htmlToText(html).slice(0, 6000)
    const jd = [description, bodyText].filter(Boolean).join('\n\n').slice(0, 4000)

    return {
      url: res.url || u.toString(),
      title,
      company: heuristicCompany(title) || heuristicCompany(bodyText.slice(0, 1000)),
      jd,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('抓取超时（15s）')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 注册路由：POST /api/scrape/job {url} → ScrapeResult（配对鉴权） */
export function registerScrapeRoutes(app: FastifyInstance): void {
  app.post('/api/scrape/job', { preHandler: requirePairing }, async (request, reply) => {
    const body = (request.body ?? {}) as { url?: string }
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) return reply.code(400).send({ error: '需提供 url' })
    try {
      const result = await scrapeJobPage(url)
      return { ok: true, ...result }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(502).send({ error: msg })
    }
  })
}
