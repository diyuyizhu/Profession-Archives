<script setup lang="ts">
import type { ModuleMeta } from '@pa/shared'

/**
 * 功能模块卡片（预留的"功能按钮"）：点击跳转对应模块占位页。
 * 结构：模块图标 + 标题 + 描述 + "进入模块 →"。
 */
defineProps<{
  module: ModuleMeta
}>()
</script>

<template>
  <RouterLink :to="module.path" class="module-card card-glass group block p-6 no-underline">
    <div class="flex items-center justify-between">
      <span
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.08)] text-[#32f08c]"
      >
        <svg
          class="h-[18px] w-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path :d="module.icon" />
        </svg>
      </span>
      <span
        class="rounded-full border border-[rgba(255,255,255,0.08)] px-2 py-0.5 text-xs text-[rgba(245,249,254,0.45)]"
      >
        {{ module.priority }}
      </span>
    </div>

    <h3 class="heading-tight mt-4 text-[17px] text-[#f5f9fe]">{{ module.title }}</h3>
    <p class="mt-1.5 text-sm leading-relaxed text-[rgba(245,249,254,0.55)]">
      {{ module.desc }}
    </p>

    <div
      class="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#32f08c] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
    >
      进入模块
      <span class="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </div>
  </RouterLink>
</template>
