<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useUiStore } from '@/stores/ui'

/**
 * 顶栏（桌面应用壳）：汉堡按钮（切换侧栏折叠）+ 当前模块标题 + 右侧窗口控制。
 * 无边框桌面版：整个 header 为拖拽区（data-tauri-drag-region），
 * 按钮区域自动不可拖；右上角三个窗口按钮（最小化/最大化/关闭）仅桌面版渲染。
 */
const ui = useUiStore()
const route = useRoute()
const title = computed(() => (route.meta.title as string) ?? '主控台')

const isDesktop = computed(() =>
  Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__),
)

function windowCmd(cmd: string): void {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke(c: string): Promise<unknown> } })
    .__TAURI_INTERNALS__
  void internals?.invoke(cmd).catch(() => undefined)
}

const WIN_BTN =
  'flex h-7 w-9 items-center justify-center rounded-md text-[13px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900'
</script>

<template>
  <header
    data-tauri-drag-region
    class="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white pl-4 pr-1"
  >
    <div class="flex min-w-0 items-center gap-3">
      <!-- 汉堡按钮：切换侧栏折叠 -->
      <button
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        title="折叠 / 展开侧栏"
        @click="ui.toggleSidebar()"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        >
          <path v-if="!ui.sidebarCollapsed" d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
          <path v-else d="M2.5 4.5h11M2.5 8h6.5M2.5 11.5h11" />
        </svg>
      </button>

      <h1 class="heading-tight truncate text-[15px] tracking-wide text-neutral-900">{{ title }}</h1>
    </div>

    <!-- 右侧：窗口控制（仅桌面版无边框时显示） -->
    <div v-if="isDesktop" class="flex shrink-0 items-center gap-1">
      <button :class="WIN_BTN" aria-label="最小化" @click="windowCmd('plugin:window|minimize')">─</button>
      <button :class="WIN_BTN" aria-label="最大化 / 还原" @click="windowCmd('plugin:window|toggle_maximize')">▢</button>
      <button
        class="flex h-7 w-9 items-center justify-center rounded-md text-[13px] text-neutral-500 transition-colors hover:bg-red-600 hover:text-white"
        aria-label="关闭"
        @click="windowCmd('plugin:window|close')"
      >
        ✕
      </button>
    </div>
  </header>
</template>
