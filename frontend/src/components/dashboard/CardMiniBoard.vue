<script setup lang="ts">
/**
 * 仪表盘 · 投递状态分布：各状态计数 + 到看板的入口。
 */
import { statusMeta } from '@pa/shared/application'
import { useApplicationStore } from '@/stores/application'

const store = useApplicationStore()
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-3">
    <div class="space-y-2">
      <div v-for="status in store.boardStatuses" :key="status" class="flex items-center justify-between">
        <span class="flex items-center gap-2 text-[12px] text-neutral-600">
          <span class="h-1.5 w-1.5 rounded-full" :class="statusMeta(status).dot" />
          {{ statusMeta(status).label }}
        </span>
        <span class="font-mono text-[13px] text-neutral-900">{{ store.stats.byStatus[status] ?? 0 }}</span>
      </div>
    </div>
    <RouterLink to="/tracking" class="text-[12px] font-medium text-neutral-900 hover:underline no-underline">
      打开看板 →
    </RouterLink>
  </div>
</template>
