/**
 * DOCX 文本提取（零依赖，浏览器端）：解析 ZIP 容器 → 解压 word/document.xml → 抽取文本。
 * 浏览器原生 DecompressionStream('deflate-raw') 解压 deflate 条目，桌面版/网页版均可用。
 */

/** 在 DataView 中找 ZIP End-of-Central-Directory 签名（0x06054b50），从尾部向前扫 */
function findEOCD(view: DataView): number {
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i
  }
  throw new Error('不是有效的 ZIP/DOCX 文件')
}

interface ZipEntry {
  method: number
  compressedSize: number
  localOffset: number
}

/** 解析中央目录 → 文件名 → 条目信息 */
function readCentralDirectory(view: DataView): Map<string, ZipEntry> {
  const eocd = findEOCD(view)
  const count = view.getUint16(eocd + 10, true)
  let ptr = view.getUint32(eocd + 16, true)
  const entries = new Map<string, ZipEntry>()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break
    const method = view.getUint16(ptr + 10, true)
    const compressedSize = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localOffset = view.getUint32(ptr + 42, true)
    const name = new TextDecoder().decode(new Uint8Array(view.buffer, ptr + 46, nameLen))
    entries.set(name, { method, compressedSize, localOffset })
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** 解压单个条目（deflate-raw / store） */
async function inflateEntry(view: DataView, entry: ZipEntry): Promise<Uint8Array> {
  const off = entry.localOffset
  if (view.getUint32(off, true) !== 0x04034b50) throw new Error('ZIP 本地头损坏')
  const nameLen = view.getUint16(off + 26, true)
  const extraLen = view.getUint16(off + 28, true)
  const dataStart = off + 30 + nameLen + extraLen
  const raw = new Uint8Array(view.buffer, dataStart, entry.compressedSize)
  if (entry.method === 0) return raw
  if (entry.method !== 8) throw new Error(`不支持的压缩方式: ${entry.method}`)
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** 从 document.xml 抽取可读文本：w:t 文本节点 + w:p 段落换行 + w:tab/w:br 空白 */
function xmlToText(xml: string): string {
  let text = ''
  const re = /<w:p[ >]|<\/w:p>|<w:tab[^>]*\/?>|<w:br[^>]*\/?>|<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<w:p ') || m[0] === '<w:p>') continue // 段落开始
    if (m[0] === '</w:p>') text += '\n'
    else if (m[0].startsWith('<w:tab')) text += '\t'
    else if (m[0].startsWith('<w:br')) text += '\n'
    else if (m[1] !== undefined) text += m[1]
  }
  // XML 实体还原
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** DOCX 文件 → 纯文本（正文 document.xml；页眉页脚忽略） */
export async function extractDocxText(data: ArrayBuffer): Promise<string> {
  const view = new DataView(data)
  const entries = readCentralDirectory(view)
  const name = entries.has('word/document.xml')
    ? 'word/document.xml'
    : [...entries.keys()].find((k) => k.endsWith('document.xml'))
  if (!name) throw new Error('DOCX 中找不到 document.xml')
  const entry = entries.get(name)!
  const xmlBytes = await inflateEntry(view, entry)
  const xml = new TextDecoder('utf-8').decode(xmlBytes)
  const text = xmlToText(xml)
  if (!text) throw new Error('DOCX 解析为空（可能是纯图片简历）')
  return text
}
