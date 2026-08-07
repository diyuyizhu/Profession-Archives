<script setup lang="ts">
/**
 * 模块内 Tab 导航（一级菜单下的细分功能切换）。
 * 首项通常是模块根路由（如 /tracking），该模块的其余子路径也算命中首项。
 */
import { useRoute, useRouter } from 'vue-router'

export interface ModuleTab {
  id: string
  label: string
  path: string
}

const props = defineProps<{ tabs: ModuleTab[] }>()
const route = useRoute()
const router = useRouter()

function isActive(tab: ModuleTab, index: number): boolean {
  if (route.path === tab.path) return true
  if (index > 0) return false
  // 首项为模块根：仅在没有任何子 Tab 精确命中时，按前缀高亮首项
  const exactHit = props.tabs.some((t) => route.path === t.path)
  return !exactHit && route.path.startsWith(`${tab.path}/`)
}
</script>

<template>
  <nav
    class="mb-6 flex flex-wrap gap-1 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(18,20,24,0.3)] p-1"
    role="tablist"
    aria-label="模块内功能"
  >
    <button
      v-for="(tab, i) in props.tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="isActive(tab, i)"
      class="rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors"
      :class="
        isActive(tab, i)
          ? 'bg-[rgba(50,240,140,0.12)] text-[#32f08c]'
          : 'text-[rgba(245,249,254,0.55)] hover:bg-[rgba(237,239,242,0.05)] hover:text-[#f5f9fe]'
      "
      @click="router.push(tab.path)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
