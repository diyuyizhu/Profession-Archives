<script setup lang="ts">
/**
 * 自动投递 · 插件配对（D1/D2 桌面端一侧的 UI）：
 * - 展示并复制配对码（插件 popup 粘贴即可完成配对）
 * - 检测本地桥服务（127.0.0.1）是否在线
 * - 插件本体（wxt MV3）在独立 extension 项目，随服务端落地接入
 */
import { onMounted, ref } from 'vue'

import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'

const PAIR_KEY = 'pa-pairing-code'

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'plugin', label: '插件配对', path: '/automation' },
  { id: 'mapping', label: '字段映射', path: '/automation/mapping' },
]
const LOCAL_BRIDGE_URL = 'http://127.0.0.1:8000/health'

/** 配对码：首次生成并持久化，之后复用 */
const pairCode = ref('')
const bridgeStatus = ref<'checking' | 'online' | 'offline'>('checking')
const copied = ref(false)
const copyError = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** 生成配对码（非安全上下文 crypto.randomUUID 不可用时降级） */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pair-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadPairCode(): string {
  let code = localStorage.getItem(PAIR_KEY)
  if (!code) {
    code = genId()
    try {
      localStorage.setItem(PAIR_KEY, code)
    } catch {
      /* 存储不可用时仍可用本次会话值 */
    }
  }
  return code
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(pairCode.value)
    copied.value = true
    copyError.value = ''
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    copyError.value = '复制失败，请手动选择复制'
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copyError.value = ''), 3200)
  }
}

/** 检测本地桥（服务端落地后生效；未启动显示离线） */
async function checkBridge(): Promise<void> {
  bridgeStatus.value = 'checking'
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(LOCAL_BRIDGE_URL, { signal: controller.signal })
    clearTimeout(timer)
    bridgeStatus.value = res.ok ? 'online' : 'offline'
  } catch {
    bridgeStatus.value = 'offline'
  }
}

onMounted(() => {
  pairCode.value = loadPairCode()
  void checkBridge()
})

const STATUS_META = {
  checking: { label: '检测中…', dot: 'bg-[#fbbf24]', text: 'text-[#fbbf24]' },
  online: { label: '本地桥在线', dot: 'bg-[#32f08c]', text: 'text-[#32f08c]' },
  offline: { label: '本地桥未运行', dot: 'bg-[#f87171]', text: 'text-[#f87171]' },
} as const
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-3xl px-6 pb-16">
      <PageHeader code="D1/D2" title="插件配对" desc="桌面端与浏览器插件建立安全连接">
        <SecondaryButton @click="checkBridge">重新检测</SecondaryButton>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- 本地桥状态 -->
      <section class="card-glass flex items-center justify-between gap-4 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] text-lg">🖥️</span>
          <div>
            <div class="text-[13.5px] font-semibold text-[#f5f9fe]">本地桥服务</div>
            <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
              仅绑定 127.0.0.1 · 插件通信通道
            </div>
          </div>
        </div>
        <span class="flex items-center gap-2 text-[13px]" :class="STATUS_META[bridgeStatus].text">
          <span class="h-2 w-2 rounded-full" :class="STATUS_META[bridgeStatus].dot" />
          {{ STATUS_META[bridgeStatus].label }}
        </span>
      </section>

      <!-- 配对码 -->
      <section class="card-glass mt-5 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">配对码</div>
        <div class="rounded-lg border border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.04)] px-4 py-3">
          <div class="font-mono text-[15px] tracking-wide text-[#32f08c]">{{ pairCode }}</div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <SecondaryButton @click="copyCode">{{ copied ? '✓ 已复制' : '复制配对码' }}</SecondaryButton>
          <span
            v-if="copied"
            role="status"
            aria-live="polite"
            class="text-[12px] text-[#60f2bd]"
          >
            已复制
          </span>
          <span
            v-if="copyError"
            role="alert"
            aria-live="assertive"
            class="text-[12px] text-[#f87171]"
          >
            {{ copyError }}
          </span>
          <span class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
            在浏览器插件 popup 粘贴此码完成配对，仅本机可见
          </span>
        </div>
        <div class="mt-2 text-[11px] text-[rgba(245,249,254,0.3)]">
          当前为占位码；服务端（本地桥）落地后，配对码改由其启动时生成并在此展示
        </div>
      </section>

      <!-- 配对步骤 -->
      <section class="card-glass mt-5 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="mb-4 text-[13px] font-semibold text-[#f5f9fe]">三步完成配对</div>
        <div class="space-y-4">
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(50,240,140,0.4)] text-[11px] font-semibold text-[#32f08c]">1</span>
            <div>
              <div class="text-[13px] font-medium text-[#f5f9fe]">启动桌面应用</div>
              <div class="mt-0.5 text-[12px] text-[rgba(245,249,254,0.5)]">
                本地桥服务随应用启动（绑定 127.0.0.1），上方状态变为「在线」
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(50,240,140,0.4)] text-[11px] font-semibold text-[#32f08c]">2</span>
            <div>
              <div class="text-[13px] font-medium text-[#f5f9fe]">复制配对码</div>
              <div class="mt-0.5 text-[12px] text-[rgba(245,249,254,0.5)]">
                使用上方「复制配对码」，它是一次性本机凭证
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(50,240,140,0.4)] text-[11px] font-semibold text-[#32f08c]">3</span>
            <div>
              <div class="text-[13px] font-medium text-[#f5f9fe]">插件 popup 粘贴完成配对</div>
              <div class="mt-0.5 text-[12px] text-[rgba(245,249,254,0.5)]">
                之后即可在岗位页「采集岗位」、投递页「填充表单」，结果自动回传看板
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="mt-5 text-center text-[11.5px] text-[rgba(245,249,254,0.3)]">
        浏览器插件（MV3，岗位采集 + 表单填充）随服务端（模块 D）落地后接入
      </div>
    </div>
  </div>
</template>
