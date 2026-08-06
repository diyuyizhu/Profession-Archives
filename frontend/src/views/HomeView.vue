<script setup lang="ts">
import { MODULES } from '@pa/shared'

import AuraBackground from '@/components/AuraBackground.vue'
import ModuleCard from '@/components/ModuleCard.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useRouter } from 'vue-router'

/** 概览统计（占位数据，M1–M5 接入真实数据） */
const stats = [
  { label: '生涯记录', value: '0', suffix: '条', desc: '日记 / 成就 / 里程碑' },
  { label: '投递中', value: '0', suffix: '个', desc: '看板状态流转' },
  { label: '面试轮次', value: '0', suffix: '场', desc: '复盘与面经沉淀' },
  { label: 'AI 提炼', value: '0', suffix: '次', desc: '日记 → 简历亮点' },
]

const router = useRouter()
</script>

<template>
  <div class="relative min-h-full">
    <!-- 顶部氛围光（随内容滚动） -->
    <AuraBackground variant="top" />

    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <!-- ═══════ 欢迎区 ═══════ -->
      <section class="flex flex-wrap items-end justify-between gap-6 py-8">
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
          <p class="mt-2 text-sm text-[rgba(245,249,254,0.55)]">
            从第一份档案开始，让每一次经历都成为复利资产
          </p>
        </div>
        <div class="flex shrink-0 gap-3">
          <PrimaryButton @click="router.push('/archive')">开始记录</PrimaryButton>
          <SecondaryButton @click="router.push('/tracking')">去投递</SecondaryButton>
        </div>
      </section>

      <!-- ═══════ 概览统计 ═══════ -->
      <section class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="s in stats" :key="s.label" class="card-glass p-4">
          <div class="font-mono-data text-[22px] font-bold leading-none text-[#32f08c]">
            {{ s.value }}<span class="ml-0.5 text-sm font-normal text-[rgba(245,249,254,0.4)]">{{ s.suffix }}</span>
          </div>
          <div class="mt-2 text-[13px] font-medium text-[#f5f9fe]">{{ s.label }}</div>
          <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.4)]">{{ s.desc }}</div>
        </div>
      </section>

      <!-- ═══════ 功能模块网格 ═══════ -->
      <section class="mt-8">
        <div class="mb-4 flex items-baseline justify-between">
          <h2 class="heading-tight text-[16px] tracking-wide text-[#f5f9fe]">功能模块</h2>
          <span class="text-xs text-[rgba(245,249,254,0.35)]">入口已预留 · 里程碑中实现</span>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ModuleCard v-for="m in MODULES" :key="m.key" :module="m" />
        </div>
      </section>

      <!-- ═══════ 隐私与安全横幅 ═══════ -->
      <section class="mt-8">
        <div class="card-glass flex flex-wrap items-center justify-between gap-4 p-5">
          <div class="flex items-center gap-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] text-lg"
            >
              🔒
            </span>
            <div>
              <div class="text-[14px] font-semibold text-[#f5f9fe]">隐私与安全</div>
              <div class="mt-0.5 text-xs text-[rgba(245,249,254,0.5)]">
                数据全存本地 · AI 出境需授权 · 插件最小权限
              </div>
            </div>
          </div>
          <SecondaryButton @click="router.push('/settings')">隐私设置</SecondaryButton>
        </div>
      </section>
    </div>
  </div>
</template>
