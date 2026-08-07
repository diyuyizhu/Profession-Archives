/**
 * 仪表盘配置 store：卡片顺序 + 每张卡片的尺寸（网格单元），localStorage 持久化。
 * 布局为 CSS Grid（6 列），卡片占 w×h 单元，支持拖拽右下角手柄调整大小。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const KEY = 'pa-dashboard-v1'

/** 网格列数 */
export const DASH_COLS = 6
/** 每行单元高度（px），拖拽换算与 min-height 用 */
export const DASH_ROW_H = 88

export interface DashCardMeta {
  key: string
  title: string
  /** 默认列宽（1–6） */
  w: number
  /** 默认行高（1–4） */
  h: number
}

/** 全部可用卡片（顺序即默认布局） */
export const DASH_CARDS: DashCardMeta[] = [
  { key: 'business-card', title: '个人名片', w: 2, h: 3 },
  { key: 'overview', title: '概览统计', w: 4, h: 3 },
  { key: 'quick-links', title: '快捷入口', w: 6, h: 2 },
  { key: 'mini-board', title: '投递状态', w: 2, h: 3 },
  { key: 'recent', title: '最近动态', w: 4, h: 3 },
  { key: 'learning', title: '学习计划', w: 2, h: 3 },
]

export type DashboardCardKey = (typeof DASH_CARDS)[number]['key']

interface PersistShape {
  order: string[]
  sizes: Record<string, { w: number; h: number }>
}

const DEFAULT_ORDER = DASH_CARDS.map((c) => c.key)

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function load(): PersistShape {
  const def: PersistShape = { order: [...DEFAULT_ORDER], sizes: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw)
    // 兼容旧版纯数组格式
    const order = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.order)
        ? parsed.order
        : null
    const sizes = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.sizes
      ? (parsed.sizes as Record<string, { w: number; h: number }>)
      : {}
    if (!Array.isArray(order)) return def

    const known = new Set<string>(DASH_CARDS.map((c) => c.key))
    const valid = [...new Set(order.filter((k): k is string => typeof k === 'string' && known.has(k)))]
    for (const k of DEFAULT_ORDER) {
      if (!valid.includes(k)) valid.push(k)
    }
    // 尺寸校验：非法回退默认
    const cleanSizes: Record<string, { w: number; h: number }> = {}
    for (const [k, s] of Object.entries(sizes)) {
      if (!known.has(k) || !s || typeof s !== 'object') continue
      const w = typeof s.w === 'number' ? clamp(Math.round(s.w), 1, DASH_COLS) : 1
      const h = typeof s.h === 'number' ? clamp(Math.round(s.h), 1, 4) : 1
      cleanSizes[k] = { w, h }
    }
    return { order: valid, sizes: cleanSizes }
  } catch {
    return def
  }
}

export const useDashboardStore = defineStore('dashboard', () => {
  const state = ref<PersistShape>(load())
  const visible = computed<string[]>(() => state.value.order)
  const sizes = computed(() => state.value.sizes)

  const hidden = computed(() => DEFAULT_ORDER.filter((k) => !state.value.order.includes(k)))

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ order: state.value.order, sizes: state.value.sizes }))
    } catch (err) {
      console.error('[dashboard] 保存失败', err)
      throw err
    }
  }

  /** 某卡片的当前尺寸（自定义覆盖 / 默认） */
  function sizeOf(key: string): { w: number; h: number } {
    const meta = DASH_CARDS.find((c) => c.key === key)
    const custom = state.value.sizes[key]
    if (custom) return custom
    return { w: meta?.w ?? 2, h: meta?.h ?? 2 }
  }

  /** 拖拽调整尺寸（clamp 到 1–6 列 / 1–4 行） */
  function setSize(key: string, w: number, h: number): void {
    state.value.sizes[key] = {
      w: clamp(Math.round(w), 1, DASH_COLS),
      h: clamp(Math.round(h), 1, 4),
    }
    persist()
  }

  function hide(key: string): void {
    state.value.order = state.value.order.filter((k) => k !== key)
    persist()
  }

  function show(key: string): void {
    if (!state.value.order.includes(key)) {
      state.value.order = [...state.value.order, key]
      persist()
    }
  }

  function moveUp(key: string): void {
    const i = state.value.order.indexOf(key)
    if (i <= 0) return
    const arr = [...state.value.order]
    ;[arr[i - 1], arr[i]] = [arr[i]!, arr[i - 1]!]
    state.value.order = arr
    persist()
  }

  function moveDown(key: string): void {
    const i = state.value.order.indexOf(key)
    if (i < 0 || i >= state.value.order.length - 1) return
    const arr = [...state.value.order]
    ;[arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!]
    state.value.order = arr
    persist()
  }

  function reset(): void {
    state.value = { order: [...DEFAULT_ORDER], sizes: {} }
    persist()
  }

  return {
    visible,
    hidden,
    sizes,
    sizeOf,
    setSize,
    hide,
    show,
    moveUp,
    moveDown,
    reset,
  }
})
