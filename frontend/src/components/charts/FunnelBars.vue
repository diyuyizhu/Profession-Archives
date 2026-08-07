<script setup lang="ts">
/**
 * 漏斗条形图（B4 转化 / F1 路线分析共用）：
 * 每行 = 阶段名 + 计数 + 相对最大值的薄荷绿渐变条。零依赖 div 实现。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    rows: Array<{ label: string; count: number }>
    /** 高亮某行（如 Offer）时传入 label */
    highlightLabel?: string
  }>(),
  { highlightLabel: undefined },
)

const max = computed(() => Math.max(...props.rows.map((r) => r.count), 1))

function pctOf(row: { label: string; count: number }): number {
  return Math.round((row.count / max.value) * 100)
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="(row, i) in rows" :key="row.label" class="flex items-center gap-3">
      <div class="flex w-32 shrink-0 items-center justify-between gap-1 pr-1">
        <span class="truncate text-[12px] text-[rgba(245,249,254,0.6)]">
          <span class="mr-1 font-mono text-[10px] text-[rgba(245,249,254,0.3)]">{{ i + 1 }}</span>
          {{ row.label }}
        </span>
        <span class="shrink-0 font-mono text-[12px] text-[#f5f9fe]">{{ row.count }}</span>
      </div>
      <div class="flex-1">
        <div
          class="flex h-[26px] items-center justify-end rounded-md border px-2"
          :class="
            row.label === highlightLabel
              ? 'border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.1)]'
              : 'border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.06)]'
          "
          :style="{ width: `${Math.max(6, pctOf(row))}%` }"
        >
          <span
            class="text-[10.5px]"
            :class="row.label === highlightLabel ? 'text-[#fbbf24]' : 'text-[#60f2bd]'"
          >
            {{ pctOf(row) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
