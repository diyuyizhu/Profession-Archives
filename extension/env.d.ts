/**
 * 环境类型声明（供 `tsc --noEmit` 使用）。
 *
 * 背景：wxt 生成的 `.wxt/tsconfig.json` 不含 `*.vue` 模块声明，
 * 裸 tsc 无法解析 `import App from './App.vue'`（`vue-tsc` 才能解析 .vue 内容）。
 * 这里补一个通用 shim，让 `npm run typecheck` 真正能跑。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
