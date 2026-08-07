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
      class="flex items-center gap-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(237,239,242,0.04)] px-3 py-2.5 transition-colors no-underline hover:border-[rgba(50,240,140,0.35)] hover:bg-[rgba(50,240,140,0.06)]"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(50,240,140,0.08)] text-[#32f08c]">
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
      <span class="truncate text-[12.5px] font-medium text-[rgba(245,249,254,0.75)]">{{ item.title }}</span>
    </RouterLink>
  </div>
</template>
