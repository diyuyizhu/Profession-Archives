<script setup lang="ts">
/**
 * 转化漏斗 + 失败原因分布（F1）：看清"死在哪个环节"。
 * - 漏斗来自投递事件日志（曾经到达）
 * - 失败原因来自 reject_reason 打标
 */
import { buildRejectionReasons } from '@pa/shared/application'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import FunnelBars from '@/components/charts/FunnelBars.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { useApplicationStore } from '@/stores/application'

const store = useApplicationStore()
const router = useRouter()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'funnel', label: '转化漏斗', path: '/growth' },
  { id: 'learning', label: '学习计划', path: '/growth/learning' },
  { id: 'skills', label: '技能追踪', path: '/growth/skills' },
]

const s = computed(() => store.stats)
const rejected = computed(() => buildRejectionReasons(store.applications))

/** 漏斗展示行：已投 → 简历被读 → 一面 → … → Offer（数据驱动，跳过备选池） */
const funnel = computed(() => {
  const rows = s.value.funnel
    .filter((r) => r.status !== 'backlog')
    .map((r) => ({ label: r.label, count: r.count }))
  rows.push({ label: 'Offer', count: s.value.byStatus.offer ?? 0 })
  return rows
})

/** 概述 */
const overview = computed(() => {
  const f = funnel.value
  const top = f[0]?.count ?? 0
  const offer = f[f.length - 1]?.count ?? 0
  return [
    { label: '投递总数', value: store.total, unit: '个' },
    { label: 'Offer', value: offer, unit: '个' },
    { label: '整体转化率', value: top ? Math.round((offer / top) * 100) : 0, unit: '%' },
    { label: '拒绝投递', value: s.value.byStatus.rejected ?? 0, unit: '个' },
  ]
})

/** 流失最大的环节（相邻阶段差绝对值最大） */
const biggestDrop = computed(() => {
  let maxDrop = 0
  let idx = -1
  for (let i = 0; i < funnel.value.length - 1; i++) {
    const drop = funnel.value[i]!.count - funnel.value[i + 1]!.count
    if (drop > maxDrop) {
      maxDrop = drop
      idx = i
    }
  }
  return idx >= 0
    ? {
        from: funnel.value[idx]!.label,
        to: funnel.value[idx + 1]!.label,
        drop: maxDrop,
      }
    : null
})

const rejectMax = computed(() => Math.max(...rejected.value.map((r) => r.count), 1))
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="F1" title="转化漏斗" desc="投递 → 面试 → Offer 全链路，看清最流失环节">
        <PrimaryButton @click="router.push('/growth/learning')">去补短板 →</PrimaryButton>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- 概览 -->
      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="o in overview" :key="o.label" class="card-glass p-4">
          <div class="font-mono-data text-[22px] font-bold leading-none text-[#32f08c]">
            {{ o.value }}<span class="ml-0.5 text-sm font-normal text-[rgba(245,249,254,0.4)]">{{ o.unit }}</span>
          </div>
          <div class="mt-2 text-[12.5px] font-medium text-[rgba(245,249,254,0.8)]">{{ o.label }}</div>
        </div>
      </section>

      <div class="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- 转化漏斗 -->
        <section class="card-glass p-5">
          <div class="mb-1 text-[13px] font-semibold text-[#f5f9fe]">各环节到达人数</div>
          <div class="mb-4 text-[11.5px] text-[rgba(245,249,254,0.4)]">
            由状态事件日志精确还原 · 含曾经到达的投递
          </div>
          <FunnelBars :rows="funnel" highlight-label="Offer" />

          <div
            v-if="biggestDrop && biggestDrop.drop > 0"
            class="mt-4 rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.06)] px-3 py-2.5 text-[12px] text-[rgba(245,249,254,0.7)]"
          >
            ⚠️ 最大流失：<span class="text-[#fbbf24]">{{ biggestDrop.from }} → {{ biggestDrop.to }}</span>
            掉了 <span class="font-mono text-[#fbbf24]">{{ biggestDrop.drop }}</span> 条，建议重点复盘该环节
          </div>
        </section>

        <!-- 失败原因分布 -->
        <section class="card-glass p-5">
          <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">失败原因分布</div>
          <div v-if="rejected.length" class="space-y-2.5">
            <div v-for="r in rejected" :key="r.reason" class="flex items-center gap-3">
              <span class="w-20 shrink-0 truncate text-[12px] text-[rgba(245,249,254,0.55)]">
                {{ r.reason }}
              </span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(237,239,242,0.08)]">
                <div
                  class="h-full rounded-full bg-[#f87171]"
                  :style="{ width: `${Math.round((r.count / rejectMax) * 100)}%` }"
                />
              </div>
              <span class="w-6 shrink-0 text-right font-mono text-[12px] text-[#f5f9fe]">
                {{ r.count }}
              </span>
            </div>
          </div>
          <div v-else class="py-6 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
            暂无拒绝记录，标记投递「拒绝」时可填写原因
          </div>
          <div class="mt-4 text-[11.5px] text-[rgba(245,249,254,0.35)]">
            在看板卡片「标记 → 拒绝」时填写失败原因，这里会自动汇总
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
