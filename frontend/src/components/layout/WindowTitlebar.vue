<script setup lang="ts">
/**
 * 自定义窗口标题栏（无边框桌面版用）：
 * - 仅 Tauri 桌面版显示（浏览器开发/网页版不渲染）
 * - data-tauri-drag-region 实现拖动；右侧最小化/最大化/关闭（core:window 权限）
 */
import { computed } from 'vue'

const isDesktop = computed(() =>
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__),
)

function windowCmd(cmd: string): void {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke(c: string): Promise<unknown> } })
    .__TAURI_INTERNALS__
  void internals?.invoke(cmd).catch(() => undefined)
}

const BTN =
  'flex h-6 w-8 items-center justify-center rounded text-[13px] text-[rgba(245,249,254,0.5)] transition-colors hover:bg-[rgba(237,239,242,0.08)] hover:text-[#f5f9fe]'
</script>

<template>
  <div
    v-if="isDesktop"
    data-tauri-drag-region
    class="flex h-9 shrink-0 select-none items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,11,13,0.92)] px-3"
  >
    <span
      data-tauri-drag-region
      class="truncate text-[11px] font-medium tracking-[0.18em] text-[rgba(245,249,254,0.45)]"
    >
      PROFESSION-ARCHIVES · 生涯大脑
    </span>
    <div class="flex items-center gap-1">
      <button :class="BTN" aria-label="最小化" @click="windowCmd('plugin:window|minimize')">─</button>
      <button :class="BTN" aria-label="最大化 / 还原" @click="windowCmd('plugin:window|toggle_maximize')">▢</button>
      <button
        class="flex h-6 w-8 items-center justify-center rounded text-[13px] text-[rgba(245,249,254,0.5)] transition-colors hover:bg-[rgba(248,113,113,0.8)] hover:text-white"
        aria-label="关闭"
        @click="windowCmd('plugin:window|close')"
      >
        ✕
      </button>
    </div>
  </div>
</template>
