<script setup lang="ts">
/**
 * 仪表盘 · 概览统计：生涯记录 / 投递中 / 面试轮次 / 学习计划。
 */
import { statusMeta } from '@pa/shared/application'
import { computed } from 'vue'

import { useApplicationStore } from '@/stores/application'
import { useInterviewStore } from '@/stores/interview'
import { useLearningStore } from '@/stores/learning'
import { useProfileStore } from '@/stores/profile'

const appStore = useApplicationStore()
const interviewStore = useInterviewStore()
const learningStore = useLearningStore()
const profileStore = useProfileStore()

const stats = computed(() => {
  const st = appStore.stats.byStatus
  const active = appStore.boardStatuses
    .filter((s) => !statusMeta(s).terminal)
    .reduce((sum, s) => sum + (st[s] ?? 0), 0)
  return [
    { label: '生涯记录', value: profileStore.profile.journal.length, unit: '条' },
    { label: '投递中', value: active, unit: '个' },
    { label: '面试轮次', value: interviewStore.total, unit: '场' },
    { label: '学习计划', value: learningStore.total, unit: '份' },
  ]
})
</script>

<template>
  <div class="grid h-full grid-cols-2 gap-3 sm:grid-cols-4">
    <div v-for="s in stats" :key="s.label" class="flex flex-col justify-center">
      <div class="font-mono-data text-[24px] font-bold leading-none text-[#32f08c]">
        {{ s.value }}<span class="ml-0.5 text-sm font-normal text-[rgba(245,249,254,0.4)]">{{ s.unit }}</span>
      </div>
      <div class="mt-1.5 text-[12px] font-medium text-[rgba(245,249,254,0.75)]">{{ s.label }}</div>
    </div>
  </div>
</template>
