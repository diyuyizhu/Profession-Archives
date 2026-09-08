<script setup lang="ts">
/**
 * popup 面板：配对 + 采集岗位 + 填充投递表单 + 清除高亮。
 * 风格与主应用一致（经典黑白：白底 + 墨黑 + 灰阶）。
 */
import { onMounted, ref } from 'vue'

const pairingCode = ref('')
const status = ref('未配对')
const actionMsg = ref('')
const mode = ref<'keyword' | 'ai'>('keyword')

async function currentTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

onMounted(async () => {
  const stored = await chrome.storage.local.get(['pairingCode', 'mode'])
  pairingCode.value = stored.pairingCode ?? ''
  mode.value = stored.mode === 'ai' ? 'ai' : 'keyword'
  status.value = pairingCode.value ? '已配对（本机）' : '未配对'
})

async function saveMode(m: 'keyword' | 'ai'): Promise<void> {
  mode.value = m
  await chrome.storage.local.set({ mode: m })
}

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

  if (mode.value === 'ai') {
    // AI 模式：发页面文本 → 桥 AI 提取岗位
    const page = await chrome.tabs
      .sendMessage(tabId, { type: 'COLLECT_PAGE_TEXT' })
      .catch(() => null)
    if (!page?.text) return flash('当前页面无法采集（请刷新后重试）')
    const res = await chrome.runtime.sendMessage({
      type: 'EXTRACT_JOB',
      payload: { text: page.text },
    })
    if (!res?.job) return flash(`AI 提取失败：${res?.error ?? '未知'}`)
    const job = res.job as { company?: string; title?: string; jd?: string }
    // 兜底：company/title 为空时回退到页面标题启发式
    const title =
      job.title?.trim() ||
      page.title ||
      '未命名岗位'
    const company =
      job.company?.trim() ||
      (page.title ? page.title.split(/[-_|·]/)[0]?.trim() : undefined) ||
      '未知公司'
    const submit = await chrome.runtime.sendMessage({
      type: 'COLLECT_JOB',
      payload: { company, title, url: page.url, jd: job.jd },
    })
    if (submit?.ok) flash(`已采集「${title}」→ 看板备选池`)
    else flash(`采集失败：${submit?.error ?? '未知'}`)
    return
  }

  // 关键词模式：本地启发式提取
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
  <div class="pa-popup">
    <!-- 头部 -->
    <div class="pa-header">
      <span class="pa-title">Profession-Archives 助手</span>
      <span class="pa-version">v0.1</span>
    </div>

    <!-- 配对 -->
    <label class="pa-label" for="pairing">配对码（桌面端「插件配对」页复制）</label>
    <input id="pairing" v-model="pairingCode" class="pa-input" placeholder="粘贴配对码" />
    <div class="pa-row">
      <button class="pa-btn pa-btn-ghost" @click="savePairing">保存配对</button>
      <span class="pa-status" :class="{ on: status !== '未配对' }">
        <i class="pa-dot" />
        {{ status }}
      </span>
    </div>

    <!-- 模式切换 -->
    <div class="pa-row">
      <span class="pa-label" style="margin-top: 0">识别模式</span>
      <div class="pa-seg">
        <button
          class="pa-seg-btn"
          :class="{ on: mode === 'keyword' }"
          @click="saveMode('keyword')"
        >
          关键词
        </button>
        <button
          class="pa-seg-btn"
          :class="{ on: mode === 'ai' }"
          @click="saveMode('ai')"
        >
          AI 分析
        </button>
      </div>
    </div>

    <!-- 操作 -->
    <button class="pa-btn pa-btn-ghost" @click="collectJob">采集当前岗位 → 看板</button>
    <button class="pa-btn pa-btn-primary" @click="fillForm">填充投递表单</button>
    <button class="pa-btn pa-btn-ghost" @click="clearFill">清除填充高亮</button>

    <!-- 反馈 -->
    <div v-if="actionMsg" class="pa-msg">{{ actionMsg }}</div>

    <!-- 合规说明 -->
    <div class="pa-foot">合规：不自动提交、不破验证码 —— 填充后请人工核对并在页面点击提交。</div>
  </div>
</template>

<style>
.pa-popup {
  width: 320px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #111827;
}

/* 头部 */
.pa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.pa-title {
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #111827;
}
.pa-version {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #9ca3af;
}

/* 标签 / 输入 */
.pa-label {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
}
.pa-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #111827;
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pa-input::placeholder {
  color: #9ca3af;
}
.pa-input:focus {
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.1);
}

/* 行 / 状态 */
.pa-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 6px;
}
.pa-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #6b7280;
}
.pa-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d1d5db;
}
.pa-status.on .pa-dot {
  background: #111827;
}
.pa-status.on {
  color: #111827;
}

/* 按钮 */
.pa-btn {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.pa-btn-ghost {
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #374151;
}
.pa-btn-ghost:hover {
  border-color: #111827;
  color: #111827;
  background: #f9fafb;
}
.pa-btn-primary {
  border: 1px solid #111827;
  background: #111827;
  color: #ffffff;
  font-weight: 500;
}
.pa-btn-primary:hover {
  background: #000000;
}

/* 反馈提示 */
.pa-msg {
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #111827;
  padding: 8px 10px;
  font-size: 11.5px;
  line-height: 1.5;
}

/* 底部说明 */
.pa-foot {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
  font-size: 10.5px;
  line-height: 1.5;
  color: #9ca3af;
}

/* 模式切换 */
.pa-seg {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid #d1d5db;
  border-radius: 8px;
}
.pa-seg-btn {
  padding: 5px 10px;
  font-size: 11px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.pa-seg-btn.on {
  background: #111827;
  color: #ffffff;
}
.pa-seg-btn:hover {
  color: #111827;
}
</style>
