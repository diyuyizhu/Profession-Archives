<script setup lang="ts">
/**
 * 隐私授权（E3）：数据出境状态一览 + 一键开关。
 * - 本地优先：数据全存本机，不依赖云同步
 * - AI 出境：云端调用需授权，可一键全局仅用本地
 * - 插件最小权限：仅当前 tab + 当前站点
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useAIConfigStore } from '@/stores/aiConfig'

const store = useAIConfigStore()
const router = useRouter()
const config = computed(() => store.config)

const error = ref('')
let errorTimer: ReturnType<typeof setTimeout> | undefined
/** 持久化动作统一 catch：存储失败给出可见反馈 */
function safeAction(action: () => void): void {
  error.value = ''
  try {
    action()
  } catch {
    error.value = '保存失败：本地存储不可用或已满'
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => (error.value = ''), 3200)
  }
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <PageHeader code="E3" title="隐私授权" desc="数据在你手里 · 出境由你决定" />

      <!-- 原则 -->
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="card-glass p-4">
          <div class="text-lg">🗄️</div>
          <div class="mt-2 text-[13px] font-semibold text-[#f5f9fe]">本地优先</div>
          <div class="mt-1 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
            档案、投递、面试全部存本机（SQLite / localStorage），可导出备份
          </div>
        </div>
        <div class="card-glass p-4">
          <div class="text-lg">🌐</div>
          <div class="mt-2 text-[13px] font-semibold text-[#f5f9fe]">出境可控</div>
          <div class="mt-1 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
            云端 AI 调用需明确授权，可一键切换「仅用本地模型」
          </div>
        </div>
        <div class="card-glass p-4">
          <div class="text-lg">🧩</div>
          <div class="mt-2 text-[13px] font-semibold text-[#f5f9fe]">插件最小权限</div>
          <div class="mt-1 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
            浏览器插件仅访问当前 tab 与当前站点，只取所需
          </div>
        </div>
      </section>

      <!-- 当前状态 -->
      <section class="card-glass mt-5 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">当前状态</div>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="text-[13px] text-[rgba(245,249,254,0.7)]">AI 来源</div>
            <span
              class="rounded-full border px-2.5 py-0.5 text-[12px]"
              :class="config.localOnly || config.provider === 'local' ? 'border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]' : 'border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)] text-[#fbbf24]'"
            >
              {{ config.localOnly || config.provider === 'local' ? '本地模型' : '云端 DeepSeek' }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-[13px] text-[rgba(245,249,254,0.7)]">云端数据出境授权</div>
              <div class="text-[11px] text-[rgba(245,249,254,0.35)]">
                首次云端调用前需授权
              </div>
            </div>
            <span
              class="rounded-full border px-2.5 py-0.5 text-[12px]"
              :class="config.dataExitConsented ? 'border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]' : 'border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] text-[#f87171]'"
            >
              {{ config.dataExitConsented ? '已授权' : '未授权' }}
            </span>
          </div>
        </div>

        <hr class="hr-faint my-4" />

        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="text-[13px] font-medium text-[#f5f9fe]">仅用本地模型</div>
            <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
              开启后强制本地，任何 AI 能力都不调用云端
            </div>
          </div>
          <div class="flex items-center gap-3">
            <SecondaryButton
              :disabled="config.localOnly"
              @click="safeAction(() => store.consentDataExit())"
            >
              授权云端调用
            </SecondaryButton>
            <button
              class="rounded-full border px-4 py-2 text-[12.5px] transition-colors"
              :class="
                config.localOnly
                  ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.04)] text-[rgba(245,249,254,0.6)]'
              "
              @click="safeAction(() => store.setLocalOnly(!config.localOnly))"
            >
              {{ config.localOnly ? '已锁定本地' : '锁定为本地' }}
            </button>
          </div>
          <span
            v-if="error"
            role="alert"
            aria-live="assertive"
            class="w-full text-[12px] text-[#f87171]"
          >
            {{ error }}
          </span>
        </div>
      </section>

      <!-- 数据导出入口 -->
      <section class="card-glass mt-5 flex items-center justify-between gap-4 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div>
          <div class="text-[13.5px] font-semibold text-[#f5f9fe]">数据导出与备份</div>
          <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
            一键导出全部本地数据为 JSON，可随时导入恢复
          </div>
        </div>
        <SecondaryButton @click="router.push('/settings/data')">去数据管理</SecondaryButton>
      </section>
    </div>
  </div>
</template>
