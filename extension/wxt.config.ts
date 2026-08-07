/**
 * wxt 配置（MV3 + Vue + TS）。
 */
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'wxt'

export default defineConfig({
  vite: () => ({ plugins: [vue()] }),
  manifest: {
    name: 'Profession-Archives 助手',
    description: '连接本地生涯档案：采集岗位、自动填充官网投递表单、回传投递状态、桌面采集（系统音频）。',
    permissions: ['storage', 'activeTab', 'tabs', 'desktopCapture'],
    host_permissions: ['<all_urls>'],
    // 本地桥通信（仅 127.0.0.1；配对 token 在 popup 中粘贴）
    web_accessible_resources: [
      {
        resources: ['*'],
        matches: ['<all_urls>'],
      },
    ],
  },
})
