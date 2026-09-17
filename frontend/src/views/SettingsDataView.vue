<script setup lang="ts">
/**
 * 数据管理：备份（导出）/ 恢复（导入）/ 撤销导入 / 清空。
 *
 * 备份文件 v2：
 * { app, schemaVersion, exportedAt, includesSecrets, stats:{keys,records,bytes,perKey}, data:{key:json字符串} }
 *
 * 导入：
 * - 先预览差异（新增 / 覆盖 / 替换模式会删除）再执行
 * - 模式二选一：完全替换（回到备份状态）或 合并（只覆盖备份里有的项）
 * - 导入前自动把当前数据存成快照（pa-rollback-v1），提供一次性「撤销上次导入」
 * - 敏感项（AI API Key / 插件配对码）默认不进备份；导入也**永不删除**本机敏感项，
 *   避免恢复一份旧备份把 API Key 抹掉
 */
import { computed, ref } from 'vue'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'

const APP_TAG = 'profession-archives'
const SCHEMA_VERSION = 2
const ROLLBACK_KEY = 'pa-rollback-v1'

/** 敏感项：默认不导出；导入时也永不删除本机的 */
const SENSITIVE_KEYS = new Set(['pa-ai-config-v1', 'pa-pairing-code'])
/** 内部项：不算业务数据，不导出、不参与差异 */
const INTERNAL_KEYS = new Set([ROLLBACK_KEY])

interface BackupPayload {
  app: string
  schemaVersion: number
  exportedAt: string
  includesSecrets: boolean
  stats?: { keys: number; records: number; bytes: number; perKey?: Record<string, number> }
  data: Record<string, string>
}

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
  flashTimer = setTimeout(() => (flash.value = null), 5000)
}

/* ── 数据收集与统计 ── */

/** 收集 pa-* 本地数据（默认排除敏感项与内部项） */
function collectAll(includeSecrets = false): Record<string, string> {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('pa-') || INTERNAL_KEYS.has(key)) continue
    if (!includeSecrets && SENSITIVE_KEYS.has(key)) continue
    data[key] = localStorage.getItem(key) ?? ''
  }
  return data
}

/** 一项里有多少条记录（数组长度 / 对象键数；解析不了算 1） */
function recordCount(value: string): number {
  try {
    const v = JSON.parse(value)
    if (Array.isArray(v)) return v.length
    if (v && typeof v === 'object') return Object.keys(v).length
    return 1
  } catch {
    return 1
  }
}

function byteSize(text: string): number {
  return new Blob([text]).size
}

const includeSecrets = ref(false)

const localStats = computed(() => {
  const data = collectAll(true)
  let records = 0
  for (const v of Object.values(data)) records += recordCount(v)
  const text = JSON.stringify(data)
  return { keys: Object.keys(data).length, records, bytes: byteSize(text) }
})

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  if (n >= 1024) return Math.round(n / 1024) + ' KB'
  return n + ' B'
}

/* ── 导出 ── */

const EXPORT_NAME = 'profession-archives-export-' + new Date().toISOString().slice(0, 10) + '.json'

async function exportData(): Promise<void> {
  const data = collectAll(includeSecrets.value)
  const text = JSON.stringify(data)
  let records = 0
  const perKey: Record<string, number> = {}
  for (const [k, v] of Object.entries(data)) {
    const n = recordCount(v)
    perKey[k] = n
    records += n
  }
  const payload: BackupPayload = {
    app: APP_TAG,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    includesSecrets: includeSecrets.value,
    stats: { keys: Object.keys(data).length, records, bytes: byteSize(text), perKey },
    data,
  }
  const out = JSON.stringify(payload, null, 2)
  try {
    if (isDesktop) {
      const path = await save({
        defaultPath: EXPORT_NAME,
        filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      })
      if (!path) return
      await writeTextFile(path, out)
      notify('ok', '已导出备份：' + path)
    } else {
      const blob = new Blob([out], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = EXPORT_NAME
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('ok', '已导出备份文件（' + Object.keys(data).length + ' 项 / ' + records + ' 条记录）')
    }
  } catch (err) {
    notify('error', '导出失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

/* ── 导入：先预览，再选择模式执行 ── */

const pending = ref<{ payload: BackupPayload; fileName: string } | null>(null)
const importMode = ref<'replace' | 'merge'>('replace')
const importing = ref(false)

/** 备份与本地库的差异 */
const diff = computed(() => {
  if (!pending.value) return null
  const backupKeys = Object.keys(pending.value.payload.data)
  const localKeys = Object.keys(collectAll(true)).filter((k) => !SENSITIVE_KEYS.has(k))
  const backupKeysSafe = backupKeys.filter((k) => !SENSITIVE_KEYS.has(k))
  return {
    added: backupKeysSafe.filter((k) => !localKeys.includes(k)),
    overwritten: backupKeysSafe.filter((k) => localKeys.includes(k) && localStorage.getItem(k) !== pending.value!.payload.data[k]),
    removed: localKeys.filter((k) => !backupKeys.includes(k)),
    sensitiveInBackup: backupKeys.filter((k) => SENSITIVE_KEYS.has(k)),
  }
})

function parseBackup(text: string, fileName: string): void {
  let payload: BackupPayload
  try {
    const parsed = JSON.parse(text) as Partial<BackupPayload>
    if (!parsed || typeof parsed !== 'object') throw new Error('不是合法 JSON')
    if (parsed.app !== APP_TAG) throw new Error('不是本应用的备份文件')
    if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
      throw new Error('备份来自更新的版本（v' + parsed.schemaVersion + '），请升级应用后再导入')
    }
    const raw = parsed.data
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('备份缺少 data 字段')
    const data: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!k.startsWith('pa-') || INTERNAL_KEYS.has(k)) continue
      if (typeof v !== 'string') throw new Error('备份包含非文本数据（键：' + k + '）')
      data[k] = v
    }
    if (!Object.keys(data).length) throw new Error('备份里没有任何可导入的数据')
    payload = {
      app: APP_TAG,
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '未知',
      includesSecrets: parsed.includesSecrets === true,
      stats: parsed.stats,
      data,
    }
  } catch (err) {
    notify('error', '导入失败：' + (err instanceof Error ? err.message : '文件格式不正确'))
    return
  }
  pending.value = { payload, fileName }
  importMode.value = 'replace'
}

function onPickFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => parseBackup(String(reader.result), file.name)
  reader.readAsText(file)
  input.value = ''
}

async function desktopImport(): Promise<void> {
  try {
    const path = await open({
      multiple: false,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    })
    if (!path) return
    const text = await readTextFile(String(path))
    parseBackup(text, String(path).split(/[\\/]/).pop() ?? 'backup.json')
  } catch (err) {
    notify('error', '导入失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

/** 执行导入：先存快照 → 写数据 → （替换模式）清理备份里没有的项 */
function applyImport(): void {
  const p = pending.value
  if (!p) return
  importing.value = true
  try {
    // 1) 导入前快照（一次性撤销用）
    const snapshot = JSON.stringify({ at: new Date().toISOString(), data: collectAll(true) })
    try {
      localStorage.setItem(ROLLBACK_KEY, snapshot)
    } catch {
      /* 快照写不下就跳过撤销能力，不阻断导入 */
    }

    // 2) 写入备份内容
    for (const [key, value] of Object.entries(p.payload.data)) {
      localStorage.setItem(key, value)
    }

    // 3) 替换模式：删除「本地有、备份没有」的业务项（敏感项永不删除）
    if (importMode.value === 'replace') {
      const backupKeys = new Set(Object.keys(p.payload.data))
      for (const key of Object.keys(collectAll(true))) {
        if (SENSITIVE_KEYS.has(key)) continue
        if (!backupKeys.has(key)) localStorage.removeItem(key)
      }
    }

    pending.value = null
    hasRollback.value = true
    notify('ok', '导入完成（' + Object.keys(p.payload.data).length + ' 项）——点「刷新以生效」后即可看到')
  } catch (err) {
    notify('error', '导入失败：' + (err instanceof Error ? err.message : String(err)))
  } finally {
    importing.value = false
  }
}

/* ── 撤销上次导入 ── */

const hasRollback = ref(localStorage.getItem(ROLLBACK_KEY) !== null)

const rollbackInfo = computed(() => {
  if (!hasRollback.value) return null
  try {
    const raw = JSON.parse(localStorage.getItem(ROLLBACK_KEY) ?? '{}') as { at?: string; data?: Record<string, string> }
    return { at: raw.at ?? '未知', keys: Object.keys(raw.data ?? {}).length }
  } catch {
    return null
  }
})

function undoImport(): void {
  const raw = localStorage.getItem(ROLLBACK_KEY)
  if (!raw) return
  if (!window.confirm('撤销上次导入，恢复到导入前的数据？')) return
  try {
    const snap = JSON.parse(raw) as { data?: Record<string, string> }
    const data = snap.data ?? {}
    // 先把当前数据也留一份，防止撤销本身造成不可逆
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v)
    const keep = new Set(Object.keys(data))
    for (const key of Object.keys(collectAll(true))) {
      if (SENSITIVE_KEYS.has(key)) continue
      if (!keep.has(key)) localStorage.removeItem(key)
    }
    localStorage.removeItem(ROLLBACK_KEY)
    hasRollback.value = false
    notify('ok', '已恢复到导入前的数据 ——点「刷新以生效」')
  } catch (err) {
    notify('error', '撤销失败：' + (err instanceof Error ? err.message : String(err)))
  }
}

function discardRollback(): void {
  localStorage.removeItem(ROLLBACK_KEY)
  hasRollback.value = false
}

/* ── 清空 ── */

function clearAllData(): void {
  if (!window.confirm('清空全部本地数据？包括档案、投递、面试、题库与 AI 配置，不可撤销。建议先导出备份。')) return
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith('pa-')) localStorage.removeItem(key)
  }
  window.location.reload()
}

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <PageHeader code="—" title="数据管理" desc="备份 · 恢复 · 撤销 · 清空，数据归你所有" />

      <div
        v-if="flash"
        role="status"
        aria-live="polite"
        class="card-glass fixed left-1/2 top-20 z-50 max-w-[92vw] -translate-x-1/2 px-5 py-3 text-[13px]"
        :class="flash.kind === 'ok' ? 'text-neutral-600' : 'text-red-600'"
      >
        {{ flash.kind === 'ok' ? '✓' : '✕' }} {{ flash.text }}
      </div>

      <!-- 存储概况 -->
      <section class="card-glass mb-5 p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-[13.5px] font-semibold text-neutral-900">本地存储</div>
            <div class="mt-0.5 text-[11.5px] text-neutral-500">
              全部数据保存在本机 · 无云端 · 共 {{ localStats.keys }} 项 / {{ localStats.records }} 条记录
            </div>
          </div>
          <span class="shrink-0 font-mono text-[13px] text-neutral-900">{{ formatBytes(localStats.bytes) }}</span>
        </div>
      </section>

      <!-- 导出 / 导入 -->
      <section class="card-glass grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div class="rounded-lg border border-neutral-200 p-4">
          <div class="text-[13.5px] font-semibold text-neutral-900">导出备份</div>
          <p class="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
            档案、投递、面试、题库、计划、技能、看板配置与自定义属性打包为一个 JSON
          </p>
          <label class="mt-3 flex cursor-pointer items-center gap-2 text-[11.5px] text-neutral-500">
            <input v-model="includeSecrets" type="checkbox" class="h-3.5 w-3.5 accent-neutral-900" />
            同时备份 AI 配置与 API Key（默认不含，分享备份前请谨慎）
          </label>
          <PrimaryButton class="mt-3" @click="exportData">导出全部数据</PrimaryButton>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4">
          <div class="text-[13.5px] font-semibold text-neutral-900">导入恢复</div>
          <p class="mt-1 text-[11.5px] leading-relaxed text-neutral-500">
            选择备份文件 → 预览差异 → 选「完全替换」或「合并」→ 执行
          </p>
          <SecondaryButton class="mt-3" @click="isDesktop ? desktopImport() : fileInput?.click()">
            选择备份文件
          </SecondaryButton>
          <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onPickFile" />
        </div>
      </section>

      <!-- 撤销上次导入 -->
      <section v-if="hasRollback" class="card-glass mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div class="text-[13px] font-semibold text-neutral-900">可撤销上次导入</div>
          <div class="mt-0.5 text-[11.5px] text-neutral-500">
            快照时间 {{ rollbackInfo?.at ?? '未知' }} · {{ rollbackInfo?.keys ?? 0 }} 项
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <SecondaryButton @click="reload">刷新以生效</SecondaryButton>
          <SecondaryButton @click="discardRollback">丢弃快照</SecondaryButton>
          <PrimaryButton @click="undoImport">撤销恢复到导入前</PrimaryButton>
        </div>
      </section>

      <!-- 危险区 -->
      <section class="card-glass mt-5 border-red-200 p-5">
        <div class="mb-1 text-[13.5px] font-semibold text-red-600">危险区</div>
        <p class="mb-4 text-[11.5px] text-neutral-500">以下操作不可撤销，请先导出备份。</p>
        <button
          class="rounded-lg border border-red-400 bg-red-50 px-5 py-2.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-100"
          @click="clearAllData"
        >
          清空全部数据
        </button>
      </section>
    </div>

    <!-- 导入预览 -->
    <Modal v-if="pending" title="确认导入" max-width="max-w-lg" @close="pending = null">
      <div class="space-y-4 text-[12.5px]">
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div class="flex justify-between gap-3"><span class="text-neutral-400">文件</span><span class="truncate text-neutral-700">{{ pending.fileName }}</span></div>
          <div class="mt-1 flex justify-between gap-3"><span class="text-neutral-400">导出时间</span><span class="text-neutral-700">{{ pending.payload.exportedAt }}</span></div>
          <div class="mt-1 flex justify-between gap-3"><span class="text-neutral-400">备份内容</span><span class="text-neutral-700">{{ Object.keys(pending.payload.data).length }} 项</span></div>
          <div class="mt-1 flex justify-between gap-3"><span class="text-neutral-400">含密钥</span><span class="text-neutral-700">{{ pending.payload.includesSecrets ? '是' : '否' }}</span></div>
        </div>

        <div v-if="diff" class="rounded-lg border border-neutral-200 p-3">
          <div class="mb-1.5 text-[11.5px] text-neutral-400">与当前数据的差异</div>
          <div class="flex justify-between gap-3"><span class="text-neutral-500">新增</span><span class="text-neutral-900">{{ diff.added.length }} 项</span></div>
          <div class="flex justify-between gap-3"><span class="text-neutral-500">覆盖（内容不同）</span><span class="text-neutral-900">{{ diff.overwritten.length }} 项</span></div>
          <div class="flex justify-between gap-3"><span class="text-neutral-500">本地独有</span><span class="text-neutral-900">{{ diff.removed.length }} 项</span></div>
          <div v-if="diff.sensitiveInBackup.length" class="mt-1.5 text-[11px] text-neutral-400">
            备份包含密钥类数据（{{ diff.sensitiveInBackup.length }} 项），导入会一并写入
          </div>
        </div>

        <div class="space-y-2">
          <label class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5" :class="importMode === 'replace' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'">
            <input v-model="importMode" type="radio" value="replace" class="mt-0.5 accent-neutral-900" />
            <span>
              <span class="block text-[12.5px] text-neutral-900">完全替换 —— 回到备份那一刻的状态</span>
              <span class="mt-0.5 block text-[11.5px] text-neutral-400">
                会删除本地独有的 {{ diff?.removed.length ?? 0 }} 项业务数据；AI 配置与配对码不会被删
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5" :class="importMode === 'merge' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'">
            <input v-model="importMode" type="radio" value="merge" class="mt-0.5 accent-neutral-900" />
            <span>
              <span class="block text-[12.5px] text-neutral-900">合并 —— 只覆盖备份里有的项</span>
              <span class="mt-0.5 block text-[11.5px] text-neutral-400">本地独有的 {{ diff?.removed.length ?? 0 }} 项保留</span>
            </span>
          </label>
        </div>

        <p class="text-[11.5px] leading-relaxed text-neutral-400">
          导入前会自动把当前数据存一份快照，导入后可在本页「撤销恢复到导入前」。
        </p>

        <div class="flex items-center justify-end gap-2 border-t border-neutral-200 pt-3">
          <SecondaryButton @click="pending = null">取消</SecondaryButton>
          <PrimaryButton :disabled="importing" @click="applyImport">
            {{ importing ? '导入中…' : '确认导入' }}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  </div>
</template>
