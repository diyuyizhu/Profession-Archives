/** pdf-parse 内部模块无类型声明（主入口带调试副作用，必须引 lib 内部实现） */
declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (data: Buffer) => Promise<{ text: string; numpages?: number }>
  export default pdfParse
}
