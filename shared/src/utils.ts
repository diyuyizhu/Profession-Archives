/**
 * 通用纯函数（无副作用）—— 前端 / 服务端共用。
 */

/** 解析用户输入的标签：中英文逗号分隔，trim 后去重并剔除空串 */
export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
}

/** 本地时区今天（YYYY-MM-DD）—— toISOString() 是 UTC，东八区清晨会落在前一天 */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
