<script setup lang="ts">
/**
 * 左侧导航栏（桌面应用壳）：一级菜单直达各模块。
 * - 折叠模式（汉堡按钮触发，72px）：只显示图标
 * - 当前路由所在模块高亮
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { NAV_ITEMS } from '@/data/nav'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const route = useRoute()

/** 当前路由所在模块：精确匹配或子路径前缀匹配（如 /tracking/detail/:id 高亮"投递看板"） */
const activeKey = computed(() => {
  const path = route.path
  return (
    NAV_ITEMS.find((i) => i.path === path || (i.path !== '/' && path.startsWith(`${i.path}/`)))
      ?.key ?? ''
  )
})
</script>

<template>
  <aside
    class="relative z-1 flex h-full shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[rgba(10,11,13,0.35)] backdrop-blur-2xl transition-[width] duration-300"
    :class="ui.sidebarCollapsed ? 'w-[72px]' : 'w-[200px]'"
  >
    <!-- logo -->
    <RouterLink
      to="/"
      class="flex h-14 shrink-0 items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] px-4 no-underline"
    >
      <img
        src="@/assets/logo-transparent.png"
        alt="Profession-Archives"
        class="h-8 w-8 shrink-0"
      />
      <div v-if="!ui.sidebarCollapsed" class="min-w-0">
        <div class="heading-tight text-[13px] leading-tight tracking-wide text-[#f5f9fe]">
          Profession-Archives
        </div>
        <div class="mt-0.5 text-[11px] leading-tight text-[rgba(245,249,254,0.35)]">
          生涯大脑 · 求职闭环
        </div>
      </div>
    </RouterLink>

    <!-- 一级导航 -->
    <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
      <div
        v-if="!ui.sidebarCollapsed"
        class="px-2 pb-2 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.3)]"
      >
        功能模块
      </div>

      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.key"
        :to="item.path"
        class="group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] text-[rgba(245,249,254,0.6)] transition-colors no-underline hover:bg-[rgba(237,239,242,0.07)] hover:text-[#f5f9fe]"
        :class="activeKey === item.key ? '!bg-[rgba(50,240,140,0.1)] !text-[#32f08c]' : ''"
        :title="ui.sidebarCollapsed ? item.title : undefined"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgba(245,249,254,0.45)] transition-colors group-hover:text-[#32f08c]"
          :class="activeKey === item.key ? '!text-[#32f08c]' : ''"
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
            <path :d="item.icon" />
          </svg>
        </span>
        <span v-if="!ui.sidebarCollapsed" class="flex-1 truncate">{{ item.title }}</span>
      </RouterLink>
    </nav>

    <!-- 底部版本 -->
    <div class="border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
      <div
        class="flex items-center gap-2"
        :class="ui.sidebarCollapsed ? 'justify-center' : ''"
        :title="ui.sidebarCollapsed ? 'v0.2 · 本地运行' : undefined"
      >
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[#32f08c]" />
        <span v-if="!ui.sidebarCollapsed" class="font-mono text-[11px] text-[rgba(245,249,254,0.45)]">
          v0.2 · 本地运行
        </span>
      </div>
    </div>
  </aside>
</template>
