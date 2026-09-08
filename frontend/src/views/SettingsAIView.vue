<script setup lang="ts">
/**
 * AI 配置（E1 双模式）：云端 DeepSeek（Anthropic 兼容网关，默认）/ 本地 Ollama。
 * 含 E3 隐私授权联动：云端调用需先授权数据出境；全局「仅用本地模型」开关强制本地。
 */
import type { AIProvider } from '@pa/shared'
import { computed, ref } from 'vue'

import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { useAIConfigStore } from '@/stores/aiConfig'

const store = useAIConfigStore()
const config = computed(() => store.config)

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'ai', label: 'AI 配置', path: '/settings' },
  { id: 'privacy', label: '隐私授权', path: '/settings/privacy' },
  { id: 'data', label: '数据管理', path: '/settings/data' },
]

const saved = ref(false)
const error = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined

/** 持久化动作统一 catch：存储失败给出可见反馈（与 save 一致） */
function safeAction(action: () => void): void {
  error.value = ''
  try {
    action()
  } catch {
    error.value = '保存失败：本地存储不可用或已满'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (error.value = ''), 3200)
  }
}

function selectProvider(p: AIProvider): void {
  safeAction(() => store.setProvider(p))
}

function save(): void {
  safeAction(() => store.update({ ...config.value }))
  if (!error.value) {
    saved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (saved.value = false), 2500)
  }
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <PageHeader code="E1" title="AI 配置" desc="云端 / 本地双模式 · 一键切换" />

      <ModuleTabs :tabs="tabs" />

      <!-- 全局仅本地开关 -->
      <section class="card-glass mb-5 flex items-center justify-between gap-4 p-5">
        <div>
          <div class="text-[13.5px] font-semibold text-neutral-900">仅用本地模型</div>
          <div class="mt-0.5 text-[11.5px] text-neutral-500">
            全局开关：开启后强制本地模型，任何 AI 能力都不会调用云端（E3）
          </div>
        </div>
        <label class="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            class="peer sr-only"
            aria-label="仅用本地模型"
            :checked="config.localOnly"
            @change="safeAction(() => store.setLocalOnly(($event.target as HTMLInputElement).checked))"
          />
          <span class="h-6 w-11 rounded-full border border-neutral-300 bg-neutral-100 transition-colors peer-checked:border-neutral-900 peer-checked:bg-neutral-300" />
          <span class="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-checked:bg-neutral-900" />
        </label>
      </section>

      <!-- Provider 选择 -->
      <section class="card-glass mb-5 p-5">
        <div class="mb-3 text-[13px] font-semibold text-neutral-900">模型来源</div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="模型来源">
          <button
            class="rounded-xl border p-4 text-left transition-colors"
            :aria-pressed="config.provider === 'cloud'"
            :class="config.provider === 'cloud' ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'"
            @click="selectProvider('cloud')"
          >
            <div class="flex items-center justify-between">
              <span class="text-[14px] font-semibold text-neutral-900">☁️ 云端 DeepSeek</span>
              <span v-if="config.provider === 'cloud'" class="text-[12px] font-medium text-neutral-900">✓</span>
            </div>
            <div class="mt-1 text-[11.5px] text-neutral-500">
              默认 · 经 Anthropic 兼容网关 · 需授权数据出境
            </div>
          </button>
          <button
            class="rounded-xl border p-4 text-left transition-colors"
            :aria-pressed="config.provider === 'local'"
            :class="config.provider === 'local' ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'"
            @click="selectProvider('local')"
          >
            <div class="flex items-center justify-between">
              <span class="text-[14px] font-semibold text-neutral-900">💻 本地 Ollama</span>
              <span v-if="config.provider === 'local'" class="text-[12px] font-medium text-neutral-900">✓</span>
            </div>
            <div class="mt-1 text-[11.5px] text-neutral-500">
              数据不出本机 · 自备模型 · 无需 Key
            </div>
          </button>
        </div>
      </section>

      <!-- 云端配置 -->
      <section v-if="config.provider === 'cloud'" class="card-glass p-5">
        <div class="mb-4 text-[13px] font-semibold text-neutral-900">云端配置</div>
        <div class="space-y-4">
          <label class="block">
            <span class="mb-1.5 block text-xs text-neutral-500">Endpoint（Anthropic 兼容网关）</span>
            <input v-model="config.cloudEndpoint" class="input-trae" placeholder="https://api.deepseek.com" />
          </label>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500">模型名</span>
              <input v-model="config.cloudModel" class="input-trae" placeholder="deepseek-chat" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500">API Key</span>
              <input v-model="config.cloudApiKey" type="password" class="input-trae" placeholder="sk-…" />
            </label>
          </div>

          <!-- E3 授权 -->
          <div
            class="rounded-lg border p-3.5"
            :class="config.dataExitConsented ? 'border-neutral-300 bg-neutral-50' : 'border-neutral-300 bg-neutral-100'"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-[12.5px] font-medium text-neutral-900">云端调用隐私授权（E3）</div>
                <div class="mt-0.5 text-[11.5px] text-neutral-500">
                  简历 / 档案内容可能随请求发往云端模型提供商
                </div>
              </div>
              <button
                v-if="!config.dataExitConsented"
                class="shrink-0 rounded-full border border-neutral-500 bg-neutral-100 px-3 py-1.5 text-[12px] font-medium text-neutral-600"
                @click="safeAction(() => store.consentDataExit())"
              >
                授权
              </button>
              <span v-else class="shrink-0 text-[12.5px] font-medium text-neutral-900">✓ 已授权</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 本地配置 -->
      <section v-else class="card-glass p-5">
        <div class="mb-4 text-[13px] font-semibold text-neutral-900">本地配置（Ollama）</div>
        <div class="space-y-4">
          <label class="block">
            <span class="mb-1.5 block text-xs text-neutral-500">Endpoint（/v1 兼容）</span>
            <input v-model="config.localEndpoint" class="input-trae" placeholder="http://localhost:11434/v1" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-neutral-500">模型名</span>
            <input v-model="config.localModel" class="input-trae" placeholder="qwen2.5:7b" />
          </label>
          <div class="text-[11.5px] text-neutral-400">
            需先在本地启动 Ollama 并拉取模型；数据完全不出本机。
          </div>
        </div>
      </section>

      <!-- 保存 -->
      <div class="mt-6 flex items-center gap-3">
        <PrimaryButton @click="save">保存配置</PrimaryButton>
        <span
          v-if="saved"
          role="status"
          aria-live="polite"
          class="text-[13px] text-neutral-600"
        >
          ✓ 已保存
        </span>
        <span
          v-if="error"
          role="alert"
          aria-live="assertive"
          class="text-[13px] text-red-600"
        >
          {{ error }}
        </span>
      </div>
    </div>
  </div>
</template>
