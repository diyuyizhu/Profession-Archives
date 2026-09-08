<script setup lang="ts">
/**
 * 自动投递 · 插件配对（D1/D2 桌面端一侧的 UI）：
 * - 展示并复制配对码（从嵌入式桥获取，插件 popup 粘贴即可完成配对）
 * - 检测本地桥服务（127.0.0.1）是否在线
 * - 同步插件采集的岗位数据到本地看板
 */
import { onMounted, ref } from 'vue'

import BridgeSyncPanel from '@/components/BridgeSyncPanel.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { fetchPairingToken } from '@/lib/bridge'

const PAIR_KEY = 'pa-pairing-code'

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'plugin', label: '插件配对', path: '/automation' },
  { id: 'mapping', label: '字段映射', path: '/automation/mapping' },
]
const BRIDGE_BASE = 'http://127.0.0.1:8000'

/** 配对码：从嵌入式桥获取；桥离线时回退 localStorage */
const pairCode = ref('')
const bridgeStatus = ref<'checking' | 'online' | 'offline'>('checking')
const copied = ref(false)
const copyError = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** 从桥获取配对 token（先试 /api/bridge/pairing 再试 server /api/automation/pairing） */
async function loadPairCode(): Promise<void> {
  const token = await fetchPairingToken()
  if (token) {
    pairCode.value = token
    return
  }
  // 回退：从 localStorage 读取或生成本地配对码
  const existing = localStorage.getItem(PAIR_KEY)
  if (existing) {
    pairCode.value = existing
    return
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    pairCode.value = crypto.randomUUID()
  } else {
    pairCode.value = `pair-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
  try { localStorage.setItem(PAIR_KEY, pairCode.value) } catch { /* ignore */ }
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

/** 检测本地桥（嵌入式桥启动即在线） */
async function checkBridge(): Promise<void> {
  bridgeStatus.value = 'checking'
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${BRIDGE_BASE}/health`, { signal: controller.signal })
    clearTimeout(timer)
    bridgeStatus.value = res.ok ? 'online' : 'offline'
  } catch {
    bridgeStatus.value = 'offline'
  }
}

onMounted(() => {
  void loadPairCode()
  void checkBridge()
})

const STATUS_META = {
  checking: { label: '检测中…', dot: 'bg-neutral-500', text: 'text-neutral-600' },
  online: { label: '本地桥在线', dot: 'bg-neutral-900', text: 'text-neutral-900' },
  offline: { label: '本地桥未运行', dot: 'bg-red-600', text: 'text-red-600' },
} as const
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-3xl px-6 pb-16">
      <PageHeader code="D1/D2" title="插件配对" desc="桌面端与浏览器插件建立安全连接">
        <SecondaryButton @click="checkBridge">重新检测</SecondaryButton>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- 本地桥状态 -->
      <section class="card-glass flex items-center justify-between gap-4 p-5">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 text-lg">🖥️</span>
          <div>
            <div class="text-[13.5px] font-semibold text-neutral-900">本地桥服务</div>
            <div class="mt-0.5 text-[11.5px] text-neutral-500">
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
      <section class="card-glass mt-5 p-5">
        <div class="mb-3 text-[13px] font-semibold text-neutral-900">配对码</div>
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div class="font-mono text-[15px] tracking-wide text-neutral-900">{{ pairCode }}</div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <SecondaryButton @click="copyCode">{{ copied ? '✓ 已复制' : '复制配对码' }}</SecondaryButton>
          <span
            v-if="copied"
            role="status"
            aria-live="polite"
            class="text-[12px] text-neutral-600"
          >
            已复制
          </span>
          <span
            v-if="copyError"
            role="alert"
            aria-live="assertive"
            class="text-[12px] text-red-600"
          >
            {{ copyError }}
          </span>
          <span class="text-[11.5px] text-neutral-400">
            在浏览器插件 popup 粘贴此码完成配对，仅本机可见
          </span>
        </div>
        <div class="mt-2 text-[11px] text-neutral-400">
          配对码由本地桥在启动时生成，随应用持久化；非本机不可用
        </div>
      </section>

      <!-- 配对步骤 -->
      <section class="card-glass mt-5 p-5">
        <div class="mb-4 text-[13px] font-semibold text-neutral-900">三步完成配对</div>
        <div class="space-y-4">
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-900 text-[11px] font-semibold text-neutral-900">1</span>
            <div>
              <div class="text-[13px] font-medium text-neutral-900">启动桌面应用</div>
              <div class="mt-0.5 text-[12px] text-neutral-500">
                本地桥服务随应用启动（绑定 127.0.0.1），上方状态变为「在线」
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-900 text-[11px] font-semibold text-neutral-900">2</span>
            <div>
              <div class="text-[13px] font-medium text-neutral-900">复制配对码</div>
              <div class="mt-0.5 text-[12px] text-neutral-500">
                使用上方「复制配对码」，它是一次性本机凭证
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-900 text-[11px] font-semibold text-neutral-900">3</span>
            <div>
              <div class="text-[13px] font-medium text-neutral-900">插件 popup 粘贴完成配对</div>
              <div class="mt-0.5 text-[12px] text-neutral-500">
                之后即可在岗位页「采集岗位」、投递页「填充表单」，结果自动回传看板
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 同步采集数据 -->
      <section class="card-glass mt-5 p-5">
        <div class="mb-2 text-[13.5px] font-semibold text-neutral-900">同步采集数据</div>
        <div class="mb-3 text-[11.5px] text-neutral-500">
          从本地桥拉取插件采集的岗位 / 投递状态，合并到看板
        </div>
        <BridgeSyncPanel />
      </section>

      <div class="mt-5 text-center text-[11.5px] text-neutral-400">
        浏览器插件（MV3，岗位采集 + 表单填充）连通本地桥 127.0.0.1:8000（随应用启动）
      </div>
    </div>
  </div>
</template>
