import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { useAIConfigStore } from './stores/aiConfig'
import { useProfileStore } from './stores/profile'
import { useUiStore } from './stores/ui'
import './style.css'
// 字体：variable 版本地打包（离线可用，无 CDN 请求）
import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-sc'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 启动时应用主题（data-theme）
const ui = useUiStore()
ui.applyTheme()
ui.watchSystem()
ui.startClock()

app.mount('#app')

// 启动即把 AI 配置 / 档案摘要同步给本地桥。
// 桥只在「保存设置」时才收到配置，此前表现为：设置页看着配好了，AI 调用却提示未配置。
void (async () => {
  try {
    useAIConfigStore().syncToBridge()
    useProfileStore().syncToBridge()
  } catch {
    /* 桥离线（浏览器模式）：静默忽略 */
  }
})()
