<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { NAV_TREE, type NavItem } from '@/data/nav'
import { useUiStore } from '@/stores/ui'

/**
 * 左侧导航栏（桌面应用壳）：
 * - 一二级菜单：一级点击展开/收起子项，二级点击跳转；
 * - 折叠模式（汉堡按钮触发，72px）：只显示一级图标，hover 弹出子菜单提示；
 * - 当前路由所在模块自动展开 + 高亮。
 */
const ui = useUiStore()
const route = useRoute()
const expanded = ref<Set<string>>(new Set([activeModuleKey()]))

function activeModuleKey(): string {
  const path = route.path
  const item = NAV_TREE.find(
    (i) => i.path === path || i.children.some((c) => c.path === path),
  )
  return item?.key ?? ''
}

// 路由变化时自动展开所在模块
watch(
  () => route.path,
  () => {
    const k = activeModuleKey()
    if (k) expanded.value.add(k)
  },
)

/** 当前路由是否命中某模块（自身或其子项） */
function isActive(item: NavItem): boolean {
  return item.path === route.path || item.children.some((c) => c.path === route.path)
}

function isChildActive(path: string): boolean {
  return route.path === path
}

/** 一级标题点击：纯切换展开/折叠（不受当前路由影响，展开后一定能再折叠） */
function toggle(item: NavItem) {
  if (ui.sidebarCollapsed) return
  if (expanded.value.has(item.key)) {
    expanded.value.delete(item.key)
  } else {
    expanded.value.add(item.key)
  }
}

const activeKey = computed(() => activeModuleKey())
</script>

<template>
  <aside
    class="relative z-1 flex h-full shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[rgba(10,11,13,0.35)] backdrop-blur-2xl transition-[width] duration-300"
    :class="ui.sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'"
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

    <!-- 模块导航 -->
    <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
      <div
        v-if="!ui.sidebarCollapsed"
        class="px-2 pb-2 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.3)]"
      >
        功能模块
      </div>

      <div v-for="item in NAV_TREE" :key="item.key" class="mb-0.5">
        <!-- 一级 -->
        <button
          class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] text-[rgba(245,249,254,0.6)] transition-colors no-underline hover:bg-[rgba(237,239,242,0.07)] hover:text-[#f5f9fe]"
          :class="isActive(item) ? '!bg-[rgba(50,240,140,0.1)] !text-[#32f08c]' : ''"
          :title="ui.sidebarCollapsed ? item.title : undefined"
          @click="toggle(item)"
        >
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[rgba(245,249,254,0.45)] transition-colors group-hover:text-[#32f08c]"
            :class="isActive(item) ? '!text-[#32f08c]' : ''"
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
          <span v-if="!ui.sidebarCollapsed" class="flex-1 truncate text-left">{{ item.title }}</span>
          <svg
            v-if="!ui.sidebarCollapsed"
            class="h-3.5 w-3.5 shrink-0 text-[rgba(245,249,254,0.3)] transition-transform duration-200"
            :class="expanded.has(item.key) ? 'rotate-90' : ''"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M6 3l5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <!-- 二级（展开时显示，带缩进线） -->
        <div
          v-if="!ui.sidebarCollapsed && expanded.has(item.key)"
          class="ml-[17px] mt-0.5 space-y-0.5 border-l border-[rgba(255,255,255,0.08)] pl-2"
        >
          <RouterLink
            v-for="child in item.children"
            :key="child.id"
            :to="child.path"
            class="block truncate rounded-md px-3 py-1.5 text-[12.5px] text-[rgba(245,249,254,0.5)] transition-colors no-underline hover:bg-[rgba(237,239,242,0.06)] hover:text-[#f5f9fe]"
            :class="isChildActive(child.path) ? '!text-[#32f08c]' : ''"
          >
            {{ child.title }}
          </RouterLink>
        </div>
      </div>
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
