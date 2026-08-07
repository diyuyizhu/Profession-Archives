<script setup lang="ts">
/**
 * 仪表盘 · 最近动态：最近更新的投递 + 最新面试。
 */
import { statusMeta } from '@pa/shared/application'
import { computed } from 'vue'

import { useApplicationStore } from '@/stores/application'
import { useInterviewStore } from '@/stores/interview'

const appStore = useApplicationStore()
const interviewStore = useInterviewStore()

const recentApps = computed(() =>
  [...appStore.applications]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 4),
)

const latestInterviews = computed(() =>
  [...interviewStore.interviews]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .slice(0, 3),
)

function companyOf(appId: string): string {
  return appStore.applications.find((a) => a.id === appId)?.company ?? ''
}
</script>

<template>
  <div class="space-y-3">
    <div v-for="app in recentApps" :key="app.id" class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <span class="truncate text-[12.5px] font-medium text-[rgba(245,249,254,0.85)]">{{ app.company }}</span>
        <span class="truncate text-[11.5px] text-[rgba(245,249,254,0.4)]"> · {{ app.title }}</span>
      </div>
      <span
        class="shrink-0 rounded-full border px-1.5 py-px text-[10px]"
        :class="[statusMeta(app.status, app.total_rounds).chip, statusMeta(app.status, app.total_rounds).text]"
      >
        {{ statusMeta(app.status, app.total_rounds).label }}
      </span>
    </div>

    <div v-if="latestInterviews.length" class="border-t border-[rgba(255,255,255,0.06)] pt-2.5">
      <div v-for="iv in latestInterviews" :key="iv.id" class="flex items-center justify-between gap-2 py-0.5">
        <span class="truncate text-[12px] text-[rgba(245,249,254,0.55)]">
          {{ companyOf(iv.application_id) }} · 第 {{ iv.round }} 轮
        </span>
        <span class="shrink-0 font-mono text-[10.5px] text-[rgba(245,249,254,0.35)]">{{ iv.occurred_at }}</span>
      </div>
    </div>

    <div v-if="!recentApps.length" class="py-4 text-center text-[11.5px] text-[rgba(245,249,254,0.3)]">
      暂无动态，先去记录一条吧
    </div>
  </div>
</template>
