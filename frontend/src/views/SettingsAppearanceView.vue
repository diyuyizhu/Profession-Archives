<script setup lang="ts">
/**
 * 外观设置：皮肤模式（跟随系统 / 白天 / 深夜 / 定时切换）+ 深夜时段配置。
 */
import type { ThemeMode } from '@pa/shared'
import { computed } from 'vue'

import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const tabs: ModuleTab[] = [
  { id: 'ai', label: 'AI 配置', path: '/settings' },
  { id: 'appearance', label: '外观', path: '/settings/appearance' },
  { id: 'privacy', label: '隐私授权', path: '/settings/privacy' },
  { id: 'data', label: '数据管理', path: '/settings/data' },
]

const MODES: Array<{ k: ThemeMode; label: string; desc: string; icon: string }> = [
  { k: 'system', label: '跟随系统', desc: '随操作系统深色/浅色设置自动切换', icon: '🖥' },
  { k: 'light', label: '白天', desc: '始终使用白底墨黑（经典黑白）', icon: '☀' },
  { k: 'dark', label: '深夜', desc: '始终使用深底浅字', icon: '🌙' },
  { k: 'schedule', label: '定时切换', desc: '在指定时段自动进入深夜模式', icon: '⏱' },
]

const resolvedLabel = computed(() => (ui.resolved === 'dark' ? '深夜' : '白天'))
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <PageHeader code="—" title="外观" desc="皮肤模式 · 白天 / 深夜 / 跟随系统 / 定时切换" />

      <ModuleTabs :tabs="tabs" />

      <section class="card-glass p-5">
        <div class="mb-4 flex items-center justify-between">
          <span class="text-[13px] font-semibold text-neutral-900">皮肤模式</span>
          <span class="text-[11.5px] text-neutral-500">当前生效：{{ resolvedLabel }}</span>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="皮肤模式">
          <button
            v-for="m in MODES"
            :key="m.k"
            class="rounded-xl border p-4 text-left transition-colors"
            :aria-pressed="ui.mode === m.k"
            :class="
              ui.mode === m.k
                ? 'border-neutral-900 bg-neutral-100'
                : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
            "
            @click="ui.setMode(m.k)"
          >
            <div class="flex items-center justify-between">
              <span class="text-[14px] font-semibold text-neutral-900">{{ m.icon }} {{ m.label }}</span>
              <span v-if="ui.mode === m.k" class="text-[12px] font-medium text-neutral-900">✓</span>
            </div>
            <div class="mt-1 text-[11.5px] text-neutral-500">{{ m.desc }}</div>
          </button>
        </div>

        <!-- 定时时段 -->
        <div v-if="ui.mode === 'schedule'" class="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div class="mb-3 text-[12.5px] font-medium text-neutral-900">深夜时段</div>
          <div class="flex flex-wrap items-center gap-3 text-[12.5px]">
            <label class="flex items-center gap-2">
              <span class="text-neutral-500">开始</span>
              <input
                :value="ui.schedule.darkStart"
                type="time"
                class="input-trae h-9 w-28 text-[12.5px]"
                @change="ui.setSchedule({ darkStart: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <span class="text-neutral-400">→</span>
            <label class="flex items-center gap-2">
              <span class="text-neutral-500">结束</span>
              <input
                :value="ui.schedule.darkEnd"
                type="time"
                class="input-trae h-9 w-28 text-[12.5px]"
                @change="ui.setSchedule({ darkEnd: ($event.target as HTMLInputElement).value })"
              />
            </label>
          </div>
          <p class="mt-3 text-[11.5px] leading-relaxed text-neutral-500">
            开始时间晚于结束时间时按跨零点处理（如 19:00 → 07:00 表示整夜深夜模式）。
            每分钟自动检查一次，到点即切换。
          </p>
        </div>

        <p class="mt-4 text-[11.5px] leading-relaxed text-neutral-400">
          设置仅保存在本机。切换立即生效，无需重启。
        </p>
      </section>
    </div>
  </div>
</template>
