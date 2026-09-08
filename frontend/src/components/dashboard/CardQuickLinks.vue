<script setup lang="ts">
/**
 * 仪表盘 · 快捷入口：一键跳转各功能模块。
 */
import { NAV_ITEMS } from '@/data/nav'
</script>

<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <RouterLink
      v-for="item in NAV_ITEMS"
      :key="item.key"
      :to="item.path"
      class="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 transition-colors no-underline hover:border-neutral-400 hover:bg-neutral-50"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-900">
        <svg
          class="h-[15px] w-[15px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path :d="item.icon" />
        </svg>
      </span>
      <span class="truncate text-[12.5px] font-medium text-neutral-700">{{ item.title }}</span>
    </RouterLink>
  </div>
</template>
