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
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-900"
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
        class="rounded-full border border-neutral-200 px-2 py-0.5 text-xs text-neutral-500"
      >
        {{ module.priority }}
      </span>
    </div>

    <h3 class="heading-tight mt-4 text-[17px] text-neutral-900">{{ module.title }}</h3>
    <p class="mt-1.5 text-sm leading-relaxed text-neutral-500">
      {{ module.desc }}
    </p>

    <div
      class="mt-4 flex items-center gap-1.5 text-sm font-medium text-neutral-900 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
    >
      进入模块
      <span class="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </div>
  </RouterLink>
</template>
