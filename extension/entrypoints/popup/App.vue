<script setup lang="ts">
/**
 * popup 面板：配对 + 采集岗位 + 填充投递表单 + 清除高亮。
 */
import { onMounted, ref } from 'vue'

const pairingCode = ref('')
const status = ref('未配对')
const actionMsg = ref('')

async function currentTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

onMounted(async () => {
  const stored = await chrome.storage.local.get('pairingCode')
  pairingCode.value = stored.pairingCode ?? ''
  status.value = pairingCode.value ? '已配对（本机）' : '未配对'
})

async function savePairing(): Promise<void> {
  await chrome.storage.local.set({ pairingCode: pairingCode.value.trim() })
  status.value = '已保存'
  actionMsg.value = ''
}

function flash(msg: string): void {
  actionMsg.value = msg
  setTimeout(() => (actionMsg.value = ''), 3000)
}

/** 采集当前岗位 → 本地桥入库看板 */
async function collectJob(): Promise<void> {
  const tabId = await currentTabId()
  if (!tabId) return flash('未找到当前标签页')
  const info = await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_CURRENT_PAGE' }).catch(() => null)
  if (!info?.title) return flash('当前页面无法采集（请刷新后重试）')
  const res = await chrome.runtime.sendMessage({
    type: 'COLLECT_JOB',
    payload: { company: info.company, title: info.title, url: info.url, jd: info.jd },
  })
  if (res?.ok) flash(`已采集「${info.title}」→ 看板备选池`)
  else flash(`采集失败：${res?.error ?? '未知'}（请先确认桌面端配对与运行）`)
}

/** 填充投递表单（拉档案 → 填充 + 高亮，人工确认后提交） */
async function fillForm(): Promise<void> {
  const tabId = await currentTabId()
  if (!tabId) return flash('未找到当前标签页')
  const res = await chrome.tabs.sendMessage(tabId, { type: 'FILL_FORM' }).catch(() => null)
  if (res?.ok) {
    flash(`已填充 ${res.filled.length} 个字段${res.unmapped.length ? `，未映射 ${res.unmapped.length} 个` : ''} —— 请核对后点页面的提交按钮`)
  } else {
    flash(`填充失败：${res?.error ?? '未知'}（请先配对并确认桌面端运行）`)
  }
}

async function clearFill(): Promise<void> {
  const tabId = await currentTabId()
  if (!tabId) return
  await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_FILL' }).catch(() => null)
  flash('已清除高亮')
}
</script>

<template>
  <div class="w-72 p-4 font-sans text-sm text-gray-800">
    <div class="mb-3 flex items-center justify-between">
      <span class="font-bold">Profession-Archives 助手</span>
      <span class="text-xs text-gray-400">v0.1</span>
    </div>

    <label class="mb-1 block text-xs text-gray-500">配对码（桌面端「插件配对」页复制）</label>
    <input
      v-model="pairingCode"
      class="mb-2 w-full rounded border px-2 py-1 text-xs"
      placeholder="粘贴配对码"
    />
    <div class="mb-3 flex items-center justify-between">
      <button class="rounded bg-blue-600 px-3 py-1 text-xs text-white" @click="savePairing">保存配对</button>
      <span class="text-xs text-gray-500">{{ status }}</span>
    </div>

    <button class="mb-2 w-full rounded border border-blue-300 px-3 py-1.5 text-xs" @click="collectJob">
      采集当前岗位 → 看板
    </button>
    <button class="mb-2 w-full rounded bg-emerald-600 px-3 py-1.5 text-xs text-white" @click="fillForm">
      填充投递表单（人工确认后提交）
    </button>
    <button class="mb-2 w-full rounded border px-3 py-1.5 text-xs" @click="clearFill">
      清除填充高亮
    </button>

    <div v-if="actionMsg" class="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs leading-relaxed">
      {{ actionMsg }}
    </div>
    <div class="mt-2 text-[11px] leading-relaxed text-gray-400">
      合规：不自动提交、不破验证码 —— 填充后请人工核对并在页面点击提交。
    </div>
  </div>
</template>
