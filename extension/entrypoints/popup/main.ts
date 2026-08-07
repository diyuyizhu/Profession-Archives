/**
 * popup 面板：配对 + 当前页操作（骨架 UI）。
 *
 * TODO（插件正式开发）：
 * - 配对：粘贴桌面端配对码 → chrome.storage.local
 * - 「采集岗位」：把 content 提取的信息回传本地桥 → 看板
 * - 「填充表单」：读取档案 → 按 per-origin 映射填充 → 高亮 → 人工确认提交
 * - 投递回传：提交成功后回传看板"已投"
 */
import { createApp } from 'vue'

import App from './App.vue'

createApp(App).mount('#app')
