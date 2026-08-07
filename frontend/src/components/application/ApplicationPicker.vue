<script setup lang="ts">
/**
 * 投递选择器：左侧候选列表（面试记录 / 面试复盘共用）。
 * 每项显示岗位/公司/状态徽章 + 自定义副行（面试轮数、复盘条数等）。
 */
import type { Application } from '@pa/shared'
import { statusMeta } from '@pa/shared/application'

defineProps<{
  candidates: Application[]
  selectedId: string | null
  /** 每项副行文案（如「面试 2 轮 · 复盘 1 条」） */
  metaFor: (app: Application) => string
  emptyHint?: string
}>()

defineEmits<{ select: [id: string] }>()
</script>

<template>
  <aside class="card-glass h-fit p-3" style="backdrop-filter: blur(28px) saturate(1.6)">
    <div class="px-2 pb-2 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
      选择投递（{{ candidates.length }}）
    </div>
    <div class="max-h-[70vh] space-y-1 overflow-y-auto">
      <button
        v-for="app in candidates"
        :key="app.id"
        class="block w-full rounded-lg px-3 py-2.5 text-left transition-colors"
        :class="selectedId === app.id ? 'bg-[rgba(50,240,140,0.1)]' : 'hover:bg-[rgba(237,239,242,0.06)]'"
        @click="$emit('select', app.id)"
      >
        <div class="truncate text-[13px] font-medium text-[#f5f9fe]">{{ app.title }}</div>
        <div class="mt-0.5 flex items-center justify-between">
          <span class="truncate text-[11.5px] text-[rgba(245,249,254,0.45)]">{{ app.company }}</span>
          <span
            class="shrink-0 rounded-full border px-1.5 py-px text-[10px]"
            :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
          >
            {{ statusMeta(app.status, app.total_rounds).label }}
          </span>
        </div>
        <div class="mt-0.5 text-[10.5px] text-[rgba(245,249,254,0.3)]">{{ metaFor(app) }}</div>
      </button>
      <div
        v-if="!candidates.length"
        class="px-3 py-6 text-center text-[11.5px] text-[rgba(245,249,254,0.3)]"
      >
        {{ emptyHint ?? '暂无投递，先去看板创建' }}
      </div>
    </div>
  </aside>
</template>
