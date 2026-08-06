<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useUiStore } from '@/stores/ui'

/**
 * 顶栏（桌面应用壳）：汉堡按钮（切换侧栏折叠）+ 当前模块标题 + 右侧状态区。
 */
const ui = useUiStore()
const route = useRoute()
const title = computed(() => (route.meta.title as string) ?? '主控台')
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,11,13,0.3)] px-4 backdrop-blur-2xl"
  >
    <div class="flex items-center gap-3">
      <!-- 汉堡按钮：薄荷绿描边徽章样式，切换侧栏折叠 -->
      <button
        class="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.08)] text-[#32f08c] transition-all duration-200 hover:bg-[rgba(50,240,140,0.18)] hover:shadow-[0_0_12px_rgba(50,240,140,0.3)]"
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

      <h1 class="heading-tight text-[15px] tracking-wide text-[#f5f9fe]">{{ title }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <span
        class="hidden items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(237,239,242,0.05)] px-3 py-1 text-[11.5px] text-[rgba(245,249,254,0.5)] sm:flex"
      >
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[#32f08c]" />
        Trae 主题
      </span>
      <span
        class="rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-2.5 py-1 font-mono text-[11px] text-[#32f08c]"
      >
        v0.2 · 预览
      </span>
    </div>
  </header>
</template>
