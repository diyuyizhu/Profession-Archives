<script setup lang="ts">
/**
 * 仪表盘 · 学习计划：最近一份进行中计划的进度 + 任务数。
 */
import { planProgress } from '@pa/shared/skill'
import { computed } from 'vue'

import { useLearningStore } from '@/stores/learning'

const store = useLearningStore()

const plan = computed(() => store.activePlans[0] ?? null)
const progress = computed(() => (plan.value ? planProgress(plan.value) : null))
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-3">
    <div v-if="plan" class="min-w-0">
      <div class="truncate text-[13px] font-semibold text-[#f5f9fe]">{{ plan.title }}</div>
      <div class="mt-2 flex items-center gap-2.5">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(237,239,242,0.08)]">
          <div
            class="h-full rounded-full bg-gradient-to-r from-[#32f08c]/70 to-[#60f2bd]"
            :style="{ width: `${progress?.pct ?? 0}%` }"
          />
        </div>
        <span class="font-mono text-[11px] text-[rgba(245,249,254,0.45)]">
          {{ progress?.done ?? 0 }}/{{ progress?.total ?? 0 }}
        </span>
      </div>
    </div>
    <div v-else class="py-4 text-center text-[11.5px] text-[rgba(245,249,254,0.3)]">
      暂无进行中的计划
    </div>
    <RouterLink to="/growth/learning" class="text-[12px] font-medium text-[#32f08c] hover:text-[#60f2bd] no-underline">
      管理学习计划 →
    </RouterLink>
  </div>
</template>
