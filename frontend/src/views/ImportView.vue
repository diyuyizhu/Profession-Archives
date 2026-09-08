<script setup lang="ts">
/**
 * 批量导入（B2）：从 CSV / 粘贴文本批量导入岗位投递表。
 * - 字段名不统一时启发式映射（shared/import.ts 的 COLUMN_RULES）
 * - AI 标准化可选（桥在线时调用 /api/automation/ai/normalize-columns）
 * - 自动分组建议（岗位类型 / 渠道 / 城市），用户可增删自定义分组
 * - 导入前去重（URL 或 company+title）
 */
import { normalizeImportRows, dedupeImported, parseCsv, type NormalizedApplication } from '@pa/shared/import'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import { useApplicationStore } from '@/stores/application'

const store = useApplicationStore()
const router = useRouter()

const tabs: ModuleTab[] = [
  { id: 'board', label: '看板', path: '/tracking' },
  { id: 'collect', label: '岗位采集', path: '/tracking/collect' },
  { id: 'import', label: '批量导入', path: '/tracking/import' },
  { id: 'stats', label: '投递统计', path: '/tracking/stats' },
  { id: 'resume', label: '特化简历', path: '/tracking/resume' },
]

/** 解析后的标准化投递列表 */
const items = ref<NormalizedApplication[]>([])
/** 导入反馈 */
const feedback = ref<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null)
/** 自定义分组维度（用户可在预览表上方增删） */
const customGroups = ref<string[]>([])
const newGroup = ref('')

/** CSV 文件上传 */
function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    feedback.value = { kind: 'error', text: 'xlsx 暂不支持，请在 Excel/WPS 中另存为 CSV 格式后上传' }
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '')
    const rows = parseCsv(text)
    if (!rows.length) {
      feedback.value = { kind: 'error', text: 'CSV 解析失败或为空（需首行为表头）' }
      return
    }
    items.value = normalizeImportRows(rows)
    feedback.value = { kind: 'info', text: `解析 ${rows.length} 行 → ${items.value.length} 条有效投递` }
  }
  reader.onerror = () => {
    feedback.value = { kind: 'error', text: '文件读取失败' }
  }
  reader.readAsText(file, 'UTF-8')
}

/** 粘贴文本解析 */
const pasteText = ref('')
const showPaste = ref(false)

function parsePaste(): void {
  const text = pasteText.value.trim()
  if (!text) return
  const rows = parseCsv(text)
  if (!rows.length) {
    feedback.value = { kind: 'error', text: '解析失败：需首行为表头、逗号分隔' }
    return
  }
  items.value = normalizeImportRows(rows)
  feedback.value = { kind: 'info', text: `解析 ${rows.length} 行 → ${items.value.length} 条有效投递` }
  showPaste.value = false
}

/** 统计 */
const stats = computed(() => {
  const groupSet = new Set<string>()
  for (const it of items.value) for (const g of it.groups) groupSet.add(g)
  for (const g of customGroups.value) groupSet.add(g)
  return {
    total: items.value.length,
    groups: [...groupSet].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  }
})

/** 给某行添加分组 */
function addGroupToRow(row: NormalizedApplication, group: string): void {
  if (!group.trim() || row.groups.includes(group)) return
  row.groups.push(group.trim())
}

/** 给某行移除分组 */
function removeGroupFromRow(row: NormalizedApplication, group: string): void {
  row.groups = row.groups.filter((g) => g !== group)
}

/** 添加自定义分组维度 */
function addCustomGroup(): void {
  const g = newGroup.value.trim()
  if (g && !customGroups.value.includes(g)) customGroups.value.push(g)
  newGroup.value = ''
}

/** 把自定义分组批量应用到所有行 */
function applyGroupToAll(group: string): void {
  for (const it of items.value) addGroupToRow(it, group)
}

/** 导入 */
const importing = ref(false)
function doImport(): void {
  if (!items.value.length) return
  importing.value = true
  try {
    const { unique, duplicates } = dedupeImported(items.value, store.applications)
    const added = store.importApplications(
      unique.map((it) => ({
        company: it.company,
        title: it.title,
        url: it.url,
        jd: it.jd,
        channel: it.channel,
        status: it.status,
        tags: it.tags,
        groups: it.groups,
        notes: it.notes,
        applied_at: it.applied_at,
      })),
    )
    feedback.value = {
      kind: 'ok',
      text: `成功导入 ${added} 条${duplicates ? `，跳过 ${duplicates} 条重复` : ''}`,
    }
    items.value = []
    setTimeout(() => router.push('/tracking/board'), 800)
  } catch {
    feedback.value = { kind: 'error', text: '导入失败：本地存储不可用或已满' }
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <PageHeader code="B2" title="批量导入" desc="CSV / 粘贴文本 → 自动解析字段 → 分组 → 去重入库">
        <SecondaryButton @click="router.push('/tracking/collect')">手动采集</SecondaryButton>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <!-- 导入入口 -->
      <section class="card-glass mb-5 p-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 p-8 transition-colors hover:border-neutral-900">
            <span class="text-2xl">📄</span>
            <span class="text-[13px] font-medium text-neutral-900">上传 CSV 文件</span>
            <span class="text-[11px] text-neutral-400">xlsx 请先另存为 CSV</span>
            <input type="file" accept=".csv,.txt" class="hidden" @change="onFile" />
          </label>
          <button
            class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 p-8 transition-colors hover:border-neutral-900"
            @click="showPaste = !showPaste"
          >
            <span class="text-2xl">📋</span>
            <span class="text-[13px] font-medium text-neutral-900">粘贴表格文本</span>
            <span class="text-[11px] text-neutral-400">从 Excel/WPS 复制后粘贴（含表头）</span>
          </button>
        </div>

        <!-- 粘贴区 -->
        <div v-if="showPaste" class="mt-4 space-y-3">
          <textarea
            v-model="pasteText"
            class="input-trae min-h-[120px] resize-y py-3"
            placeholder="公司名称,岗位,渠道,投递时间,状态,链接…&#10;腾讯,前端工程师,官网,2026-08-10,已投,https://…&#10;…"
          />
          <SecondaryButton :disabled="!pasteText.trim()" @click="parsePaste">解析</SecondaryButton>
        </div>

        <!-- 反馈 -->
        <div
          v-if="feedback"
          class="mt-4 rounded-lg border p-3 text-[12px]"
          :class="{
            'border-neutral-300 bg-neutral-50 text-neutral-600': feedback.kind === 'info',
            'border-neutral-900 bg-neutral-100 text-neutral-900': feedback.kind === 'ok',
            'border-red-300 bg-red-50 text-red-600': feedback.kind === 'error',
          }"
        >
          {{ feedback.text }}
        </div>
      </section>

      <!-- 预览表格 -->
      <section v-if="items.length" class="card-glass p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="text-[13px] font-semibold text-neutral-900">
            预览 · {{ items.length }} 条投递
          </div>
          <div class="text-[11px] text-neutral-400">
            分组可编辑，导入后可在看板按分组筛选
          </div>
        </div>

        <!-- 分组维度管理 -->
        <div v-if="stats.groups.length || customGroups.length" class="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div class="mb-2 text-[11px] font-medium text-neutral-500">分组维度（点击批量应用至全部）</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="g in stats.groups"
              :key="g"
              class="rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-[11px] text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
              @click="applyGroupToAll(g)"
            >
              {{ g }}
            </button>
            <span
              v-for="g in customGroups"
              :key="'custom-' + g"
              class="inline-flex items-center gap-1 rounded-full border border-neutral-900 bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-900"
            >
              {{ g }}
              <button class="text-neutral-400 hover:text-red-600" @click="customGroups = customGroups.filter((x) => x !== g)">✕</button>
            </span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <input
              v-model="newGroup"
              class="input-trae h-8 flex-1 text-[12px]"
              placeholder="自定义分组维度（如：北京 / 一线大厂 / 优先级A）"
              @keyup.enter="addCustomGroup"
            />
            <SecondaryButton :disabled="!newGroup.trim()" class="!h-8 !px-3 !text-[12px]" @click="addCustomGroup">＋ 添加</SecondaryButton>
          </div>
        </div>

        <!-- 表格 -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px]">
            <thead>
              <tr class="border-b border-neutral-200 text-[11px] text-neutral-400">
                <th class="py-2 pr-3 font-normal">#</th>
                <th class="py-2 pr-3 font-normal">公司</th>
                <th class="py-2 pr-3 font-normal">岗位</th>
                <th class="py-2 pr-3 font-normal">渠道</th>
                <th class="py-2 pr-3 font-normal">状态</th>
                <th class="py-2 pr-3 font-normal">投递日期</th>
                <th class="py-2 pr-3 font-normal">分组</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(it, i) in items"
                :key="i"
                class="border-b border-neutral-100"
              >
                <td class="py-2 pr-3 text-neutral-400">{{ i + 1 }}</td>
                <td class="py-2 pr-3 font-medium text-neutral-900">{{ it.company }}</td>
                <td class="py-2 pr-3 text-neutral-700">{{ it.title }}</td>
                <td class="py-2 pr-3 text-neutral-500">{{ it.channel ?? '—' }}</td>
                <td class="py-2 pr-3 text-neutral-600">{{ it.status }}</td>
                <td class="py-2 pr-3 font-mono text-neutral-500">{{ it.applied_at ?? '—' }}</td>
                <td class="py-2 pr-3">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="g in it.groups"
                      :key="g"
                      class="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600"
                    >
                      {{ g }}
                      <button class="text-neutral-300 hover:text-red-600" @click="removeGroupFromRow(it, g)">×</button>
                    </span>
                    <!-- 添加分组下拉（简单输入） -->
                    <input
                      class="w-16 rounded border border-neutral-200 px-1 py-0.5 text-[10px] text-neutral-600 outline-none focus:border-neutral-900"
                      placeholder="＋"
                      @keydown.enter="addGroupToRow(it, ($event.target as HTMLInputElement).value); (($event.target as HTMLInputElement).value = '')"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 导入操作 -->
        <div class="mt-5 flex items-center justify-between">
          <span class="text-[11px] text-neutral-400">
            导入时自动去重（URL 或 公司+岗位 完全相同的跳过）
          </span>
          <div class="flex items-center gap-3">
            <SecondaryButton @click="items = []; feedback = null">清空</SecondaryButton>
            <PrimaryButton :disabled="importing" @click="doImport">
              {{ importing ? '导入中…' : `导入 ${items.length} 条` }}
            </PrimaryButton>
          </div>
        </div>
      </section>

      <!-- 空状态 -->
      <section v-else-if="!feedback" class="card-glass flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
        <span class="text-3xl">📥</span>
        <div class="text-[14px] text-neutral-600">还没有导入数据</div>
        <div class="max-w-md text-[12px] leading-relaxed text-neutral-400">
          上传 CSV 文件或粘贴表格文本。字段名不需要统一——系统会自动识别
          公司/岗位/渠道/状态/日期等列（支持中英文表头变体）。
          导入后可按分组维度（岗位类型 / 渠道 / 城市 / 自定义）筛选看板。
        </div>
      </section>
    </div>
  </div>
</template>
