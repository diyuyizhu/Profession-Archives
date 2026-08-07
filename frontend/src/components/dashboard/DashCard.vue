<script setup lang="ts">
/**
 * 仪表盘卡片容器（CSS Grid 单元）：
 * - 根元素是网格子项，占 sizeOf(w×h) 个单元
 * - 右下角手柄拖拽调整大小（悬停显现），实时换算网格单元并持久化
 * - 编辑模式下显示上移 / 下移 / 隐藏控件
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { DASH_ROW_H, useDashboardStore } from '@/stores/dashboard'

const props = defineProps<{
  cardKey: string
  title: string
  isEditing: boolean
}>()

const dash = useDashboardStore()

const container = ref<HTMLElement | null>(null)
const size = computed(() => dash.sizeOf(props.cardKey))

/** 网格样式：md+ 用 CSS 变量控制 span（移动端归 1 列），min-height 给行高下限 */
function spanStyle(): Record<string, string> {
  return {
    '--dash-w': String(size.value.w),
    '--dash-h': String(size.value.h),
    minHeight: `${size.value.h * DASH_ROW_H + (size.value.h - 1) * 16}px`,
  }
}

/* ── 拖拽调整大小 ── */
interface DragState {
  startW: number
  startH: number
  x: number
  y: number
  colW: number
  rowH: number
}
let drag: DragState | null = null
let dragging = false

function onPointerDown(e: PointerEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const el = container.value
  if (!el) return
  const { w, h } = dash.sizeOf(props.cardKey)
  // 由当前卡片宽度反推单列宽（含 gap）
  const colW = (el.offsetWidth - (w - 1) * 16) / w
  drag = { startW: w, startH: h, x: e.clientX, y: e.clientY, colW, rowH: DASH_ROW_H }
  dragging = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return
  const dw = Math.round((e.clientX - drag.x) / (drag.colW + 16))
  const dh = Math.round((e.clientY - drag.y) / (drag.rowH + 16))
  dash.setSize(props.cardKey, drag.startW + dw, drag.startH + dh)
}

function onPointerUp(): void {
  drag = null
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onBeforeUnmount(() => {
  if (drag) onPointerUp()
})
</script>

<template>
  <section
    ref="container"
    class="dash-card card-glass group relative flex flex-col overflow-hidden p-5"
    :class="dragging ? 'cursor-nwse-resize select-none' : ''"
    :style="spanStyle()"
  >
    <div class="mb-4 flex shrink-0 items-center justify-between">
      <h2 class="text-[13px] font-semibold tracking-wide text-[#f5f9fe]">{{ title }}</h2>
      <div v-if="isEditing" class="flex items-center gap-1">
        <button
          class="rounded border border-[rgba(255,255,255,0.12)] px-2 py-0.5 text-[11px] text-[rgba(245,249,254,0.55)] hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
          title="上移"
          @click="dash.moveUp(cardKey)"
        >
          ↑
        </button>
        <button
          class="rounded border border-[rgba(255,255,255,0.12)] px-2 py-0.5 text-[11px] text-[rgba(245,249,254,0.55)] hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
          title="下移"
          @click="dash.moveDown(cardKey)"
        >
          ↓
        </button>
        <button
          class="rounded border border-[rgba(248,113,113,0.3)] px-2 py-0.5 text-[11px] text-[rgba(248,113,113,0.7)] hover:bg-[rgba(248,113,113,0.1)]"
          title="隐藏此卡片"
          @click="dash.hide(cardKey)"
        >
          隐藏
        </button>
      </div>
    </div>

    <!-- 内容：小卡时内容区滚动，大卡时铺开 -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <slot />
    </div>

    <!-- 拖拽调整大小手柄（悬停显现） -->
    <div
      class="absolute bottom-1 right-1 flex h-4 w-4 cursor-nwse-resize items-end justify-end opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100"
      :title="`拖拽调整大小（当前 ${size.w}×${size.h}）`"
      @pointerdown="onPointerDown"
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="rgba(50,240,140,0.8)" stroke-width="1.5">
        <path d="M11 11h4M11 13h4M4 11h4M4 13h4" stroke-linecap="round" />
      </svg>
    </div>
  </section>
</template>
