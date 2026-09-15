<script setup lang="ts">
/**
 * JD 语义匹配（E2 / B3）：用本地关键词打分预估匹配度，给出定制 summary 建议。
 * 接入后端 AI 后升级为语义匹配（embedding / LLM 评分）。
 */
import type { Application } from '@pa/shared'
import { matchJdToProfile } from '@pa/shared/ai'
import { computed, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useProfileStore } from '@/stores/profile'

const appStore = useApplicationStore()
const profileStore = useProfileStore()

const jd = ref('')
const pickedId = ref<string | null>(null)
const result = ref<ReturnType<typeof matchJdToProfile> | null>(null)
const savedNote = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined

/** 有 JD 的投递（可一键带入） */
const jdApps = computed<Application[]>(() => appStore.applications.filter((a) => a.jd?.trim()))

function pick(appId: string): void {
  const app = appStore.applications.find((a) => a.id === appId)
  if (!app?.jd) return
  pickedId.value = appId
  jd.value = app.jd
  result.value = null
}

function run(): void {
  if (!jd.value.trim()) return
  result.value = matchJdToProfile(jd.value, profileStore.profile)
}

/** 把 summary 建议写入档案简介（重复应用不叠加；不把工具提示/元文本写进个人简介） */
function applySummary(): void {
  if (!result.value) return
  const suggestion = result.value.summarySuggestion.trim()
  // 元文本：无匹配时的使用提示 / "匹配到 X/Y" 过程噪音，不应成为个人简介内容
  if (/关键词较少|建议补充|匹配到/.test(suggestion)) {
    savedNote.value = '当前建议仅为匹配统计，未写入档案简介'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (savedNote.value = ''), 3200)
    return
  }
  const base = profileStore.profile.summary?.trim() ?? ''
  const merged = base.includes(suggestion) ? base : base ? `${base}\n\n${suggestion}` : suggestion
  try {
    profileStore.saveBasics({ summary: merged })
    savedNote.value = '已并入档案简介'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (savedNote.value = ''), 3200)
  } catch {
    savedNote.value = '保存失败：本地存储不可用或已满'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (savedNote.value = ''), 3200)
  }
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <PageHeader code="E2" title="JD 语义匹配" desc="档案与岗位描述匹配度分析 · 定制 summary 建议" />

      <!-- 输入 -->
      <section class="card-glass p-5">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="text-[12px] text-neutral-500">从投递带入：</span>
          <select
            v-model="pickedId"
            class="input-trae h-9 w-auto min-w-[200px] appearance-none text-[12.5px]"
            @change="pick(pickedId as string)"
          >
            <option :value="null" disabled>选择有 JD 的投递…</option>
            <option v-for="app in jdApps" :key="app.id" :value="app.id">
              {{ app.company || '未填公司' }} · {{ app.title || '未命名岗位' }}
            </option>
          </select>
          <span v-if="!jdApps.length" class="text-[11px] text-neutral-400">
            暂无带 JD 的投递，也可直接粘贴下方
          </span>
        </div>

        <label class="block">
          <span class="mb-1.5 block text-xs text-neutral-500">JD 全文</span>
          <textarea
            v-model="jd"
            class="input-trae min-h-[140px] resize-y py-3"
            placeholder="粘贴岗位描述…"
          />
        </label>

        <div class="mt-4 flex items-center justify-end">
          <PrimaryButton :disabled="!jd.trim()" @click="run">分析匹配度</PrimaryButton>
        </div>
      </section>

      <!-- 结果 -->
      <section v-if="result" class="card-glass mt-5 p-5">
        <div class="flex flex-wrap items-center gap-6">
          <!-- 总分 -->
          <div class="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-2"
            :class="result.score >= 60 ? 'border-neutral-900' : result.score >= 35 ? 'border-neutral-500' : 'border-red-500'"
          >
            <span class="font-mono-data text-[30px] font-bold" :class="result.score >= 60 ? 'text-neutral-900' : result.score >= 35 ? 'text-neutral-600' : 'text-red-600'">
              {{ result.score }}
            </span>
            <span class="text-[11px] text-neutral-400">匹配度 %</span>
          </div>

          <div class="min-w-0 flex-1">
            <!-- 已覆盖 -->
            <div class="mb-2.5">
              <div class="mb-1.5 text-[11.5px] font-medium text-neutral-600">✓ 档案已覆盖（{{ result.matched.length }}）</div>
              <div v-if="result.matched.length" class="flex flex-wrap gap-1.5">
                <span v-for="k in result.matched" :key="k" class="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                  {{ k }}
                </span>
              </div>
              <div v-else class="text-[11.5px] text-neutral-400">JD 关键词较少，或档案尚未覆盖</div>
            </div>
            <!-- 缺口 -->
            <div>
              <div class="mb-1.5 text-[11.5px] font-medium text-neutral-600">⚠️ 档案缺口（{{ result.missing.length }}）</div>
              <div v-if="result.missing.length" class="flex flex-wrap gap-1.5">
                <span v-for="k in result.missing" :key="k" class="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                  {{ k }}
                </span>
              </div>
              <div v-else class="text-[11.5px] text-neutral-400">无缺口</div>
            </div>
          </div>
        </div>

        <!-- 逐条得分 -->
        <div v-if="result.byItem.length" class="mt-5">
          <div class="mb-2 text-[11.5px] font-medium text-neutral-400">经历 / 项目匹配度</div>
          <div class="space-y-2">
            <div v-for="(item, i) in result.byItem" :key="item.id ?? i" class="flex items-center gap-3">
              <div class="w-56 min-w-0 shrink-0">
                <div class="truncate text-[12.5px] text-neutral-700">{{ item.title }}</div>
                <div class="truncate text-[10.5px] text-neutral-400">{{ item.subtitle }}</div>
              </div>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div class="h-full rounded-full bg-neutral-400" :style="{ width: `${item.score}%` }" />
              </div>
              <span class="w-8 shrink-0 text-right font-mono text-[11.5px] text-neutral-900">{{ item.score }}</span>
            </div>
          </div>
        </div>

        <!-- summary 建议 -->
        <div class="mt-5">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[11.5px] font-medium text-neutral-400">定制个人简介（summary）建议</span>
            <button class="text-[11.5px] text-neutral-900 hover:underline" @click="applySummary">
              应用到档案简介
            </button>
          </div>
          <p class="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-700">
            {{ result.summarySuggestion }}
          </p>
          <span v-if="savedNote" role="status" aria-live="polite" class="mt-1 block text-[12px] text-neutral-600">
            {{ savedNote.startsWith('保存失败') ? '✕' : '✓' }} {{ savedNote }}
          </span>
        </div>
      </section>

      <div v-else class="mt-5 text-center text-[12px] text-neutral-400">
        粘贴 JD 后点击「分析匹配度」—— 当前为本地关键词打分，接入 AI 后升级为语义匹配
      </div>
    </div>
  </div>
</template>
