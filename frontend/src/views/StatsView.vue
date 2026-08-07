<script setup lang="ts">
/**
 * 投递统计（B4）：状态分布 / 渠道分布 / 月度趋势 / 转化漏斗。
 * 数据来自 store.stats（@pa/shared 纯函数聚合），条状图用 div 实现，零依赖。
 */
import { statusMeta } from '@pa/shared/application'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import FunnelBars from '@/components/charts/FunnelBars.vue'
import PageHeader from '@/components/PageHeader.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'

const store = useApplicationStore()
const router = useRouter()

const s = computed(() => store.stats)

/** 概览数字 */
const overview = computed(() => {
  const st = s.value.byStatus
  const active = store.boardStatuses
    .filter((st2) => !statusMeta(st2).terminal)
    .reduce((sum, st2) => sum + (st[st2] ?? 0), 0)
  const total = store.total
  const offer = st.offer ?? 0
  return [
    { label: '投递总数', value: total, unit: '个' },
    { label: '进行中', value: active, unit: '个' },
    { label: 'Offer', value: offer, unit: '个' },
    {
      label: 'Offer 转化率',
      value: total ? Math.round((offer / total) * 100) : 0,
      unit: '%',
    },
  ]
})

/** 漏斗展示行：已投 → 简历被读 → 一面 → … → Offer（数据驱动，跳过备选池） */
const funnel = computed(() => {
  const rows = s.value.funnel
    .filter((r) => r.status !== 'backlog')
    .map((r) => ({ label: r.label, count: r.count }))
  rows.push({ label: 'Offer', count: s.value.byStatus.offer ?? 0 })
  return rows
})

function barWidth(count: number): string {
  const max = Math.max(...s.value.byStatus ? Object.values(s.value.byStatus) : [0], 1)
  return `${Math.round((count / max) * 100)}%`
}

function channelMax(): number {
  return Math.max(...s.value.byChannel.map((c) => c.count), 1)
}

function monthMax(): number {
  return Math.max(...s.value.byMonth.map((m) => m.count), 1)
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="B4" title="投递统计" desc="渠道 / 状态 / 时间 · 转化概览">
        <SecondaryButton @click="router.push('/tracking/board')">返回看板</SecondaryButton>
      </PageHeader>

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
        <!-- 状态分布 -->
        <section class="card-glass p-5">
          <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">状态分布</div>
          <div class="space-y-2.5">
            <div v-for="status in store.boardStatuses" :key="status" class="flex items-center gap-3">
              <span class="w-14 shrink-0 text-[12px] text-[rgba(245,249,254,0.55)]">
                {{ statusMeta(status).label }}
              </span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(237,239,242,0.08)]">
                <div
                  class="h-full rounded-full"
                  :class="statusMeta(status).dot"
                  :style="{ width: barWidth(s.byStatus[status] ?? 0) }"
                />
              </div>
              <span class="w-6 shrink-0 text-right font-mono text-[12px] text-[#f5f9fe]">
                {{ s.byStatus[status] ?? 0 }}
              </span>
            </div>
          </div>
        </section>

        <!-- 渠道分布 -->
        <section class="card-glass p-5">
          <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">渠道分布</div>
          <div v-if="s.byChannel.length" class="space-y-2.5">
            <div v-for="c in s.byChannel" :key="c.channel" class="flex items-center gap-3">
              <span class="w-20 shrink-0 truncate text-[12px] text-[rgba(245,249,254,0.55)]">
                {{ c.channel }}
              </span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(237,239,242,0.08)]">
                <div
                  class="h-full rounded-full bg-[#38bdf8]"
                  :style="{ width: `${Math.round((c.count / channelMax()) * 100)}%` }"
                />
              </div>
              <span class="w-6 shrink-0 text-right font-mono text-[12px] text-[#f5f9fe]">
                {{ c.count }}
              </span>
            </div>
          </div>
          <div v-else class="py-6 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
            暂无投递数据
          </div>
        </section>
      </div>

      <!-- 月度趋势 -->
      <section class="card-glass mt-4 p-5">
        <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">投递趋势（近 12 月）</div>
        <div class="flex h-[120px] items-end gap-1.5">
          <div
            v-for="m in s.byMonth"
            :key="m.month"
            role="img"
            :aria-label="`${m.month} · ${m.count} 条投递`"
            class="group flex flex-1 flex-col items-center gap-1.5"
          >
            <div class="relative w-full">
              <div
                class="mx-auto w-full rounded-t bg-gradient-to-t from-[#32f08c]/70 to-[#60f2bd]"
                :style="{
                  height: m.count ? `${Math.max(6, Math.round((m.count / monthMax()) * 110))}px` : '2px',
                  opacity: m.count ? 1 : 0.25,
                }"
              />
              <span
                v-if="m.count"
                class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-[9px] text-[#60f2bd] opacity-0 transition-opacity group-hover:opacity-100"
              >
                {{ m.count }}
              </span>
            </div>
            <span class="font-mono text-[9.5px] text-[rgba(245,249,254,0.35)]">
              {{ m.month.slice(5) }}
            </span>
          </div>
        </div>
      </section>

      <!-- 转化漏斗 -->
      <section class="card-glass mt-4 p-5">
        <div class="mb-1 text-[13px] font-semibold text-[#f5f9fe]">转化漏斗</div>
        <div class="mb-4 text-[11.5px] text-[rgba(245,249,254,0.4)]">
          各阶段"曾经到达"的投递数（含终态），可见"死在哪个环节"
        </div>
        <FunnelBars :rows="funnel" highlight-label="Offer" />
      </section>
    </div>
  </div>
</template>
