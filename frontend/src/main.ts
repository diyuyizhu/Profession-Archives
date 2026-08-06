import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'
import './style.css'
// 字体：variable 版本地打包（离线可用，无 CDN 请求）
import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-sc'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 启动时应用主题（data-theme）
useUiStore().applyTheme()

app.mount('#app')
