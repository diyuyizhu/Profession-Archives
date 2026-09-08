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
      <div class="truncate text-[13px] font-semibold text-neutral-900">{{ plan.title }}</div>
      <div class="mt-2 flex items-center gap-2.5">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
          <div
            class="h-full rounded-full bg-neutral-900"
            :style="{ width: `${progress?.pct ?? 0}%` }"
          />
        </div>
        <span class="font-mono text-[11px] text-neutral-500">
          {{ progress?.done ?? 0 }}/{{ progress?.total ?? 0 }}
        </span>
      </div>
    </div>
    <div v-else class="py-4 text-center text-[11.5px] text-neutral-400">
      暂无进行中的计划
    </div>
    <RouterLink to="/growth/learning" class="text-[12px] font-medium text-neutral-900 hover:underline no-underline">
      管理学习计划 →
    </RouterLink>
  </div>
</template>
