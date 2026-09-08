<script setup lang="ts">
/**
 * 素材提炼（A3 / E2）：选中多条零散日记/记录，提炼为结构化亮点。
 * 当前为本地启发式（无后端兜底），接入后端 AI 后升级为模型生成。
 * 提炼结果可一键保存为「成就」。
 */
import type { JournalEntry } from '@pa/shared'
import { extractHighlights } from '@pa/shared/ai'
import { computed, ref } from 'vue'

import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'extract', label: '素材提炼', path: '/ai' },
  { id: 'polish', label: '简历润色', path: '/ai/polish' },
  { id: 'match', label: 'JD 匹配', path: '/ai/match' },
]

const entries = computed(() => profileStore.profile.journal)
const selectedIds = ref<Set<string>>(new Set())

const result = ref<{ bullets: string[]; summary: string } | null>(null)
const savedNote = ref('')
const saveError = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined

const TYPE_LABEL: Record<JournalEntry['entry_type'], string> = {
  journal: '日记',
  achievement: '成就',
  milestone: '里程碑',
}

const TYPE_COLOR: Record<JournalEntry['entry_type'], string> = {
  journal: 'text-neutral-500',
  achievement: 'text-neutral-900',
  milestone: 'text-neutral-700',
}

function toggle(id: string): void {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  result.value = null
}

function toggleAll(): void {
  if (selectedIds.value.size === entries.value.length) selectedIds.value.clear()
  else selectedIds.value = new Set(entries.value.map((e) => e.id))
  result.value = null
}

function generate(): void {
  const selected = entries.value.filter((e) => selectedIds.value.has(e.id))
  if (!selected.length) return
  result.value = extractHighlights(selected)
}

/** 保存防抖：避免连点产生重复"AI 提炼亮点"成就 */
const savingAchievement = ref(false)

function saveAsAchievement(): void {
  if (savingAchievement.value || !result.value?.summary.trim()) return
  savingAchievement.value = true
  saveError.value = ''
  try {
    profileStore.addJournalEntry({
      entry_type: 'achievement',
      title: 'AI 提炼亮点',
      content_md: result.value.summary,
      occurred_at: new Date().toISOString().slice(0, 10),
      tags: [],
    })
    savedNote.value = '已保存为「成就」'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (savedNote.value = ''), 3200)
  } catch {
    saveError.value = '保存失败：本地存储不可用或已满'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (saveError.value = ''), 3200)
  } finally {
    savingAchievement.value = false
  }
}

function snippetOf(md: string, max = 56): string {
  const text = md.replace(/[#>*`_~\-]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <PageHeader code="E2" title="素材提炼" desc="选中零散记录 → 提炼成简历可用的结构化亮点" />

      <ModuleTabs :tabs="tabs" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <!-- 左：素材选择 -->
        <section class="card-glass h-fit p-4">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[13px] font-semibold text-neutral-900">
              选择素材（{{ selectedIds.size }}/{{ entries.length }}）
            </span>
            <button class="text-[11.5px] text-neutral-400 hover:text-neutral-900" @click="toggleAll">
              {{ selectedIds.size === entries.length ? '全不选' : '全选' }}
            </button>
          </div>

          <div class="max-h-[60vh] space-y-2 overflow-y-auto">
            <button
              v-for="entry in entries"
              :key="entry.id"
              type="button"
              class="block w-full rounded-lg border p-3 text-left transition-colors"
              :aria-pressed="selectedIds.has(entry.id)"
              :class="
                selectedIds.has(entry.id)
                  ? 'border-neutral-900 bg-neutral-100'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100'
              "
              @click="toggle(entry.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-[12px] font-medium" :class="TYPE_COLOR[entry.entry_type]">
                  {{ TYPE_LABEL[entry.entry_type] }}
                </span>
                <span class="shrink-0 font-mono text-[10.5px] text-neutral-400">
                  {{ entry.occurred_at }}
                </span>
              </div>
              <div v-if="entry.title" class="mt-1 truncate text-[13px] font-semibold text-neutral-900">
                {{ entry.title }}
              </div>
              <div class="mt-0.5 line-clamp-2 text-[11.5px] text-neutral-500">
                {{ snippetOf(entry.content_md) }}
              </div>
              <div v-if="entry.tags.length" class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="t in entry.tags"
                  :key="t"
                  class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400"
                >
                  #{{ t }}
                </span>
              </div>
            </button>

            <div
              v-if="!entries.length"
              class="px-3 py-10 text-center text-[12px] text-neutral-400"
            >
              档案里还没有日记/成就/里程碑，先去「生涯档案」记录
            </div>
          </div>
        </section>

        <!-- 右：提炼结果 -->
        <section class="min-w-0">
          <div class="card-glass p-5">
            <div class="mb-4 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-neutral-900">提炼结果</span>
              <span class="text-[11px] text-neutral-400">本地启发式 · 接入 AI 后升级</span>
            </div>

            <PrimaryButton :disabled="!selectedIds.size" @click="generate">
              提炼 {{ selectedIds.size }} 条素材
            </PrimaryButton>

            <div v-if="!result" class="mt-6 px-2 py-10 text-center text-[12px] text-neutral-400">
              左侧选择素材后点击提炼，结果可编辑、可保存为成就
            </div>

            <div v-else class="mt-4 space-y-4">
              <!-- 要点 -->
              <div>
                <div class="mb-2 text-[11.5px] font-medium text-neutral-400">提炼要点</div>
                <div v-for="(bullet, i) in result.bullets" :key="i" class="mb-1.5 flex items-center gap-2">
                  <input v-model="result.bullets[i]" class="input-trae h-9 text-[12.5px]" />
                </div>
              </div>

              <!-- 摘要（成就正文） -->
              <label class="block">
                <span class="mb-1.5 block text-xs text-neutral-500">结构化摘要（保存为成就的正文）</span>
                <textarea
                  v-model="result.summary"
                  class="input-trae min-h-[110px] resize-y py-2.5"
                />
              </label>

              <div class="flex items-center gap-3">
                <PrimaryButton @click="saveAsAchievement">保存为成就</PrimaryButton>
                <span v-if="savedNote" role="status" aria-live="polite" class="text-[12.5px] text-neutral-600">
                  ✓ {{ savedNote }}
                </span>
                <span v-if="saveError" role="alert" aria-live="assertive" class="text-[12.5px] text-red-600">
                  {{ saveError }}
                </span>
              </div>
            </div>
          </div>

          <!-- 说明 -->
          <div class="card-glass mt-4 p-4 text-[12px] leading-relaxed text-neutral-500">
            <div class="mb-1 font-medium text-neutral-700">说明</div>
            当前提炼为本地启发式（截取要点 + 合并摘要）。配置 AI 并接入后端后，将升级为真实模型提炼，生成更贴合简历的亮点表述。
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
