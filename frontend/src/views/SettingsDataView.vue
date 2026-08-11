<script setup lang="ts">
/**
 * 数据管理：一键导出 / 导入 / 重置。
 * 数据全部存 localStorage（key 前缀 pa-），导出为单个 JSON 文件。
 */
import { computed, ref } from 'vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useInterviewStore } from '@/stores/interview'
import { useLearningStore } from '@/stores/learning'
import { useProfileStore } from '@/stores/profile'
import { useQuestionBankStore } from '@/stores/questionBank'
import { useSkillTrackStore } from '@/stores/skillTrack'

const profileStore = useProfileStore()
const appStore = useApplicationStore()
const interviewStore = useInterviewStore()
const questionBank = useQuestionBankStore()
const learningStore = useLearningStore()
const skillTrack = useSkillTrackStore()

const fileInput = ref<HTMLInputElement | null>(null)
const flash = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined

/** 是否桌面版（Tauri）：导出/导入调用系统文件对话框 */
const isDesktop = Boolean(
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
)

function notify(kind: 'ok' | 'error', text: string): void {
  flash.value = { kind, text }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), 4000)
}

/** 备份中排除的敏感 key（API Key / 配对码不应随备份导出明文） */
const SENSITIVE_KEYS = new Set(['pa-ai-config-v1', 'pa-pairing-code'])

/** 收集 pa-* 本地数据（排除敏感项） */
function collectAll(): Record<string, string> {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('pa-') && !SENSITIVE_KEYS.has(key)) {
      data[key] = localStorage.getItem(key) ?? ''
    }
  }
  return data
}

const EXPORT_NAME = `profession-archives-export-${new Date().toISOString().slice(0, 10)}.json`

async function exportData(): Promise<void> {
  const payload = { app: 'profession-archives', exportedAt: new Date().toISOString(), data: collectAll() }
  const text = JSON.stringify(payload, null, 2)
  try {
    if (isDesktop) {
      // 桌面版：系统保存对话框，用户选位置
      const path = await save({
        defaultPath: EXPORT_NAME,
        filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      })
      if (!path) return // 用户取消
      await writeTextFile(path, text)
      notify('ok', `已导出备份：${path}`)
    } else {
      // 浏览器版：下载
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = EXPORT_NAME
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('ok', '已导出备份文件')
    }
  } catch (err) {
    notify('error', `导出失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 解析并写入备份（校验 → 原子写入 → 清理旧 key） */
function applyImportContent(text: string): void {
  try {
    const parsed = JSON.parse(text) as { app?: string; data?: unknown }
    if (parsed.app !== 'profession-archives') throw new Error('不是本应用的备份文件')
    const raw = parsed.data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('备份格式不正确')
    const entries = Object.entries(raw as Record<string, unknown>).filter(([k]) =>
      k.startsWith('pa-'),
    ) as [string, unknown][]
    for (const [, value] of entries) {
      if (typeof value !== 'string') throw new Error('备份包含非文本数据')
    }
    // 原子化：先校验，再写入新 key，成功后才清理不再使用的旧 key
    for (const [key, value] of entries as [string, string][]) {
      try {
        localStorage.setItem(key, value)
      } catch {
        throw new Error('写入失败：存储不可用或空间不足（可能已写入部分数据，请重新导入完整备份）')
      }
    }
    const newKeys = new Set(entries.map(([k]) => k))
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('pa-') && !newKeys.has(key)) localStorage.removeItem(key)
    }
    notify('ok', '导入成功，正在刷新…')
    setTimeout(() => window.location.reload(), 800)
  } catch (err) {
    notify(
      'error',
      err instanceof Error ? `导入失败：${err.message}` : '导入失败：文件格式不正确',
    )
  }
}

/** 桌面版导入：系统打开对话框选备份文件 */
async function desktopImport(): Promise<void> {
  try {
    const path = await open({
      multiple: false,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (!path) return // 用户取消
    const text = await readTextFile(String(path))
    applyImportContent(text)
  } catch (err) {
    notify('error', `导入失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

function onPickFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    applyImportContent(String(reader.result))
  }
  reader.readAsText(file)
  input.value = ''
}

function resetToDemo(): void {
  if (!window.confirm('重置为演示数据？当前档案/投递/面试/计划/技能数据将被替换（AI 配置保留）。')) return
  profileStore.resetToDemo()
  appStore.resetToDemo()
  interviewStore.clearAll()
  questionBank.clearAll()
  learningStore.clearAll()
  skillTrack.clearAll()
  notify('ok', '已重置为演示数据')
}

function clearAllData(): void {
  if (!window.confirm('清空全部本地数据？此操作不可撤销，请先导出备份。')) return
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith('pa-')) localStorage.removeItem(key)
  }
  window.location.reload()
}

/** 存储占用（近似） */
const storageUsed = computed(() => {
  let bytes = 0
  for (const v of Object.values(collectAll())) bytes += v.length * 2
  return bytes
})

function formatBytes(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <PageHeader code="—" title="数据管理" desc="导出 · 导入 · 重置，数据归你所有" />

      <!-- 提示 -->
      <div
        v-if="flash"
        role="status"
        aria-live="polite"
        class="card-glass fixed left-1/2 top-20 z-50 -translate-x-1/2 px-5 py-3 text-[13px]"
        :class="flash.kind === 'ok' ? 'text-[#60f2bd]' : 'text-[#f87171]'"
      >
        {{ flash.kind === 'ok' ? '✓' : '✕' }} {{ flash.text }}
      </div>

      <!-- 存储概况 -->
      <section class="card-glass mb-5 flex items-center justify-between gap-4 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div>
          <div class="text-[13.5px] font-semibold text-[#f5f9fe]">本地存储</div>
          <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
            全部数据保存在本机浏览器 / 应用本地 · 无云端
          </div>
        </div>
        <span class="font-mono text-[13px] text-[#32f08c]">{{ formatBytes(storageUsed) }}</span>
      </section>

      <!-- 导出 / 导入 -->
      <section class="card-glass grid grid-cols-1 gap-4 p-5 sm:grid-cols-2" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="rounded-lg border border-[rgba(255,255,255,0.08)] p-4">
          <div class="text-[13.5px] font-semibold text-[#f5f9fe]">导出备份</div>
          <p class="mt-1 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
            档案、投递、面试、题库、计划、技能一键打包为 JSON
          </p>
          <PrimaryButton class="mt-3" @click="exportData">导出全部数据</PrimaryButton>
        </div>
        <div class="rounded-lg border border-[rgba(255,255,255,0.08)] p-4">
          <div class="text-[13.5px] font-semibold text-[#f5f9fe]">导入恢复</div>
          <p class="mt-1 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.45)]">
            选择备份文件，覆盖本地数据并刷新
          </p>
          <SecondaryButton class="mt-3" @click="isDesktop ? desktopImport() : fileInput?.click()">选择备份文件</SecondaryButton>
          <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onPickFile" />
        </div>
      </section>

      <!-- 危险区 -->
      <section class="card-glass mt-5 border-[rgba(248,113,113,0.2)] p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="mb-1 text-[13.5px] font-semibold text-[#f87171]">危险区</div>
        <p class="mb-4 text-[11.5px] text-[rgba(245,249,254,0.45)]">
          以下操作会替换 / 清空数据，请先导出备份。
        </p>
        <div class="flex flex-wrap gap-3">
          <SecondaryButton @click="resetToDemo">重置为演示数据</SecondaryButton>
          <button
            class="rounded-lg border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.08)] px-5 py-2.5 text-[13px] font-medium text-[#f87171] transition-colors hover:bg-[rgba(248,113,113,0.15)]"
            @click="clearAllData"
          >
            清空全部数据
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
