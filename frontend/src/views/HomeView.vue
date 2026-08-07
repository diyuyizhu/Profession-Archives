<script setup lang="ts">
/**
 * 主控台（自定义仪表盘）：
 * - 默认展示 个人名片 / 概览 / 快捷入口 / 投递状态 / 最近动态 / 学习计划
 * - 「自定义」进入编辑模式：卡片可隐藏 / 恢复 / 上下排序，配置持久化（类似 Kimi 看板）
 */
import type { Component } from 'vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AuraBackground from '@/components/AuraBackground.vue'
import CardBusinessCard from '@/components/dashboard/CardBusinessCard.vue'
import CardLearning from '@/components/dashboard/CardLearning.vue'
import CardMiniBoard from '@/components/dashboard/CardMiniBoard.vue'
import CardOverview from '@/components/dashboard/CardOverview.vue'
import CardQuickLinks from '@/components/dashboard/CardQuickLinks.vue'
import CardRecent from '@/components/dashboard/CardRecent.vue'
import DashCard from '@/components/dashboard/DashCard.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { DASH_CARDS, useDashboardStore } from '@/stores/dashboard'

const dash = useDashboardStore()
const router = useRouter()
const editing = ref(false)

/** key → 内容组件 */
const CARD_COMPONENTS: Record<string, Component> = {
  'business-card': CardBusinessCard,
  overview: CardOverview,
  'quick-links': CardQuickLinks,
  'mini-board': CardMiniBoard,
  recent: CardRecent,
  learning: CardLearning,
}

function titleOf(key: string): string {
  return DASH_CARDS.find((c) => c.key === key)?.title ?? key
}

function toggleEdit(): void {
  editing.value = !editing.value
}
</script>

<template>
  <div class="relative min-h-full">
    <!-- 顶部氛围光（随内容滚动） -->
    <AuraBackground variant="top" />

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-16">
      <!-- ═══════ 欢迎区 ═══════ -->
      <section class="flex flex-wrap items-end justify-between gap-4 py-8">
        <div class="min-w-0">
          <div
            class="mb-3 flex w-fit items-center gap-2 rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-3 py-1 text-xs text-[#32f08c]"
          >
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[#32f08c]" />
            本地优先 · AI 辅助 · 长期主义
          </div>
          <h1 class="heading-tight text-2xl tracking-wide text-[#f5f9fe]">
            欢迎使用 <span class="text-brand-gradient">生涯大脑</span>
          </h1>
          <p class="mt-1 text-sm text-[rgba(245,249,254,0.55)]">
            你的职业资产仪表盘 · 可自定义布局
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <SecondaryButton @click="toggleEdit">
            {{ editing ? '完成调整' : '⚙ 自定义' }}
          </SecondaryButton>
          <PrimaryButton @click="router.push('/archive')">开始记录</PrimaryButton>
        </div>
      </section>

      <!-- 编辑提示条 -->
      <div
        v-if="editing"
        class="card-glass mb-5 flex flex-wrap items-center justify-between gap-3 p-4"
        style="backdrop-filter: blur(28px) saturate(1.6)"
      >
        <span class="text-[12.5px] text-[rgba(245,249,254,0.6)]">
          编辑模式：卡片可 <span class="text-[#32f08c]">上移 / 下移</span> 排序，或
          <span class="text-[#f87171]">隐藏</span>；隐藏的卡片在底部托盘恢复。
        </span>
        <button
          class="rounded-full border border-[rgba(255,255,255,0.15)] px-3 py-1 text-[12px] text-[rgba(245,249,254,0.6)] hover:text-[#f5f9fe]"
          @click="dash.reset()"
        >
          恢复默认布局
        </button>
      </div>

      <!-- ═══════ 仪表盘卡片区（CSS Grid，卡片可拖拽调整大小） ═══════ -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-6">
        <DashCard
          v-for="key in dash.visible"
          :key="key"
          :card-key="key"
          :title="titleOf(key)"
          :is-editing="editing"
        >
          <component :is="CARD_COMPONENTS[key]" />
        </DashCard>
      </div>

      <!-- 编辑模式：隐藏托盘 -->
      <section
        v-if="editing && dash.hidden.length"
        class="card-glass mt-5 p-4"
        style="backdrop-filter: blur(28px) saturate(1.6)"
      >
        <div class="mb-2.5 text-[12px] font-medium text-[rgba(245,249,254,0.45)]">
          已隐藏卡片（点击恢复）
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="key in dash.hidden"
            :key="key"
            class="rounded-full border border-dashed border-[rgba(255,255,255,0.2)] px-3 py-1 text-[12px] text-[rgba(245,249,254,0.55)] transition-colors hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
            @click="dash.show(key)"
          >
            ＋ {{ titleOf(key) }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
