import type { ThemeMode, ThemeName, ThemeSchedule } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const MODE_KEY = 'pa-theme-mode'
const SCHEDULE_KEY = 'pa-theme-schedule'
const SIDEBAR_KEY = 'pa-sidebar-collapsed'

function loadMode(): ThemeMode {
  const v = localStorage.getItem(MODE_KEY)
  return v === 'light' || v === 'dark' || v === 'schedule' || v === 'system' ? v : 'system'
}

function loadSchedule(): ThemeSchedule {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ThemeSchedule>
      if (typeof p.darkStart === 'string' && typeof p.darkEnd === 'string') {
        return { darkStart: p.darkStart, darkEnd: p.darkEnd }
      }
    }
  } catch { /* ignore */ }
  return { darkStart: '19:00', darkEnd: '07:00' }
}

/** HH:mm → 分钟数 */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 当前是否处于深夜时段（start > end 表示跨零点） */
function inDarkWindow(s: ThemeSchedule, now = new Date()): boolean {
  const cur = now.getHours() * 60 + now.getMinutes()
  const a = toMin(s.darkStart)
  const b = toMin(s.darkEnd)
  if (a === b) return false
  return a < b ? cur >= a && cur < b : cur >= a || cur < b
}

/**
 * UI 状态：皮肤模式（跟随系统 / 白天 / 深夜 / 定时切换）+ 侧栏折叠。
 * 解析后的实际皮肤写入 <html data-theme>，由 style.css 的变量层驱动。
 */
export const useUiStore = defineStore('ui', () => {
  const mode = ref<ThemeMode>(loadMode())
  const schedule = ref<ThemeSchedule>(loadSchedule())
  const systemDark = ref(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')
  let clock: ReturnType<typeof setInterval> | undefined

  /** 解析实际皮肤 */
  const resolved = computed<ThemeName>(() => {
    if (mode.value === 'light') return 'light'
    if (mode.value === 'dark') return 'dark'
    if (mode.value === 'schedule') return inDarkWindow(schedule.value) ? 'dark' : 'light'
    return systemDark.value ? 'dark' : 'light'
  })

  function applyTheme(): void {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', resolved.value)
    document.documentElement.style.colorScheme = resolved.value
  }

  function setMode(next: ThemeMode): void {
    mode.value = next
    localStorage.setItem(MODE_KEY, next)
    applyTheme()
  }

  function setSchedule(next: Partial<ThemeSchedule>): void {
    schedule.value = { ...schedule.value, ...next }
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule.value))
    applyTheme()
  }

  /** 跟随系统：监听 prefers-color-scheme 变化 */
  function watchSystem(): void {
    if (typeof window === 'undefined') return
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      systemDark.value = e.matches
      applyTheme()
    })
  }

  /** 定时模式：每分钟检查（到点自动切换，跨零点也能生效） */
  function startClock(): void {
    if (clock) clearInterval(clock)
    clock = setInterval(() => {
      if (mode.value === 'schedule') applyTheme()
    }, 60_000)
  }

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  }

  return {
    mode, schedule, resolved, systemDark, sidebarCollapsed,
    applyTheme, setMode, setSchedule, watchSystem, startClock, toggleSidebar,
  }
})