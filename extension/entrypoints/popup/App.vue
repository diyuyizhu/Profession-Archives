<script setup lang="ts">
/**
 * popup 面板：配对 + 采集岗位 + 填充投递表单 + 清除高亮。
 * 风格与主应用一致（暗色 #0a0b0d + 薄荷绿 #32f08c + 毛玻璃卡片）。
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
  color: #f5f9fe;
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
  background: linear-gradient(90deg, #3ee1a3, #32f08c 40%, #a0fde7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.pa-version {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: rgba(245, 249, 254, 0.35);
}

/* 标签 / 输入 */
.pa-label {
  display: block;
  font-size: 11px;
  color: rgba(245, 249, 254, 0.55);
  margin-top: 4px;
}
.pa-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(237, 239, 242, 0.06);
  color: #f5f9fe;
  font-size: 12.5px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pa-input::placeholder {
  color: rgba(245, 249, 254, 0.3);
}
.pa-input:focus {
  border-color: rgba(50, 240, 140, 0.6);
  box-shadow: 0 0 0 3px rgba(50, 240, 140, 0.12);
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
  color: rgba(245, 249, 254, 0.45);
}
.pa-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(245, 249, 254, 0.25);
}
.pa-status.on .pa-dot {
  background: #32f08c;
  box-shadow: 0 0 6px rgba(50, 240, 140, 0.7);
}
.pa-status.on {
  color: #32f08c;
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(237, 239, 242, 0.05);
  color: rgba(245, 249, 254, 0.75);
}
.pa-btn-ghost:hover {
  border-color: rgba(50, 240, 140, 0.4);
  color: #32f08c;
  background: rgba(50, 240, 140, 0.06);
}
.pa-btn-primary {
  border: 1px solid rgba(50, 240, 140, 0.5);
  background: rgba(50, 240, 140, 0.12);
  color: #32f08c;
  font-weight: 500;
}
.pa-btn-primary:hover {
  background: rgba(50, 240, 140, 0.2);
  box-shadow: 0 0 12px rgba(50, 240, 140, 0.25);
}

/* 反馈提示 */
.pa-msg {
  border-radius: 8px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
  color: #fbbf24;
  padding: 8px 10px;
  font-size: 11.5px;
  line-height: 1.5;
}

/* 底部说明 */
.pa-foot {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 10.5px;
  line-height: 1.5;
  color: rgba(245, 249, 254, 0.35);
}
</style>
