import type { ThemeName } from '@pa/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'pa-theme'
const SIDEBAR_KEY = 'pa-sidebar-collapsed'
const DEFAULT_THEME: ThemeName = 'trae'

/**
 * 前端 UI 状态：主题应用（当前仅 Trae 默认风，预留多主题扩展）+ 侧栏折叠。
 * 将来新增主题只扩展 ThemeName 联合类型 + style.css 中对应变量层。
 */
export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemeName>(loadTheme())
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')

  function loadTheme(): ThemeName {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    return saved === 'trae' ? saved : DEFAULT_THEME
  }

  function applyTheme(name: ThemeName = theme.value): void {
    theme.value = name
    document.documentElement.setAttribute('data-theme', name)
    localStorage.setItem(STORAGE_KEY, name)
  }

  /** 切换侧栏折叠（220px ↔ 72px 图标模式），持久化 */
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  }

  return { theme, sidebarCollapsed, applyTheme, toggleSidebar }
})
