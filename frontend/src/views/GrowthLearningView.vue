<script setup lang="ts">
/**
 * 学习计划（F2）：短板补足计划 + 任务追踪。
 * - 手动创建（任务按行输入）
 * - "由复盘生成"：从面试复盘待改进项自动生成任务（本地启发式）
 */
import type { LearningPlan, LearningTask } from '@pa/shared'
import { planProgress } from '@pa/shared/skill'
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useInterviewStore } from '@/stores/interview'
import { useLearningStore } from '@/stores/learning'
import { uid } from '@/data/seed'

const store = useLearningStore()
const interviewStore = useInterviewStore()

const showCreate = ref(false)
const createForm = ref({ title: '', description: '', tasksText: '' })

/** 最新复盘（跨全部投递取最近一条）的待改进项 —— "由复盘生成"的素材 */
const reflectionImprovements = computed(() => {
  const latest = [...interviewStore.reflections].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  )[0]
  return latest ? [...latest.improvements, ...latest.next_strategy] : []
})

function openCreate(): void {
  createForm.value = { title: '', description: '', tasksText: '' }
  showCreate.value = true
}

function saveCreate(): void {
  if (!createForm.value.title.trim()) return
  const tasks = createForm.value.tasksText
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ id: uid('lt'), title: t, done: false }))
  store.addPlan({
    title: createForm.value.title.trim(),
    description: createForm.value.description.trim() || undefined,
    source: 'manual',
    tasks,
  })
  showCreate.value = false
}

/** 由最新复盘自动生成学习计划 */
function createFromReflection(): void {
  const improvements = reflectionImprovements.value
  if (!improvements.length) {
    window.alert('暂无复盘待改进项，请先在「面试复盘」生成复盘')
    return
  }
  const tasks: LearningTask[] = improvements.slice(0, 6).map((t) => ({
    id: uid('lt'),
    title: t.replace(/^第 \d+ 轮[：:]?\s*/, '').trim() || t,
    done: false,
  }))
  store.addPlan({
    title: `补足：${improvements[0]!.slice(0, 18)}`,
    description: '由面试复盘待改进项自动生成 · 可编辑调整',
    source: 'reflection',
    tasks,
  })
}

function taskTitleOf(plan: LearningPlan): string {
  return plan.title
}

function progressOf(plan: LearningPlan) {
  return planProgress(plan)
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-3xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="F2" title="学习计划" desc="由复盘 / 手动生成计划，逐个任务补足短板">
        <SecondaryButton
          :disabled="!reflectionImprovements.length"
          title="从最新面试复盘的待改进项生成"
          @click="createFromReflection"
        >
          由复盘生成
        </SecondaryButton>
        <PrimaryButton @click="openCreate">＋ 新建计划</PrimaryButton>
      </PageHeader>

      <!-- 空态 -->
      <div
        v-if="!store.plans.length"
        class="card-glass flex flex-col items-center justify-center gap-3 px-5 py-14 text-center"
      >
        <span class="text-3xl">📈</span>
        <div class="text-[14px] text-[rgba(245,249,254,0.6)]">还没有学习计划</div>
        <div class="text-[12px] text-[rgba(245,249,254,0.35)]">
          去「转化漏斗」看短板，或让复盘自动生成补足计划
        </div>
      </div>

      <!-- 计划列表 -->
      <div v-else class="space-y-4">
        <div v-for="plan in [...store.plans].reverse()" :key="plan.id" class="card-glass p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="heading-tight text-[15px] text-[#f5f9fe]">{{ taskTitleOf(plan) }}</span>
                <span
                  v-if="plan.source === 'reflection'"
                  class="rounded-full border border-[rgba(56,189,248,0.25)] bg-[rgba(56,189,248,0.06)] px-1.5 py-px text-[10px] text-[#38bdf8]"
                >
                  复盘生成
                </span>
              </div>
              <p v-if="plan.description" class="mt-0.5 text-[12px] text-[rgba(245,249,254,0.45)]">
                {{ plan.description }}
              </p>
            </div>
            <button
              class="shrink-0 text-[11.5px] text-[rgba(245,249,254,0.35)] hover:text-[#f87171]"
              @click="store.removePlan(plan.id)"
            >
              删除计划
            </button>
          </div>

          <!-- 进度 -->
          <div class="mt-3 flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(237,239,242,0.08)]">
              <div
                class="h-full rounded-full bg-gradient-to-r from-[#32f08c]/70 to-[#60f2bd]"
                :style="{ width: `${progressOf(plan).pct}%` }"
              />
            </div>
            <span class="font-mono text-[11px] text-[rgba(245,249,254,0.45)]">
              {{ progressOf(plan).done }}/{{ progressOf(plan).total }}
            </span>
          </div>

          <!-- 任务 -->
          <div class="mt-3 space-y-1.5">
            <div
              v-for="task in plan.tasks"
              :key="task.id"
              class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[rgba(237,239,242,0.04)]"
            >
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-[#32f08c]"
                :checked="task.done"
                @change="store.toggleTask(plan.id, task.id)"
              />
              <span
                class="min-w-0 flex-1 text-[13px]"
                :class="task.done ? 'text-[rgba(245,249,254,0.3)] line-through' : 'text-[rgba(245,249,254,0.75)]'"
              >
                {{ task.title }}
              </span>
              <button
                class="shrink-0 text-[11px] text-[rgba(245,249,254,0.25)] hover:text-[#f87171]"
                @click="store.removeTask(plan.id, task.id)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- 追加任务 -->
          <div class="mt-3 flex items-center gap-2">
            <input
              class="input-trae h-9 text-[12.5px]"
              :aria-label="`向计划「${plan.title}」追加任务`"
              placeholder="追加一个任务，回车添加…"
              @keydown.enter="
                (e: KeyboardEvent) => {
                  const el = e.target as HTMLInputElement
                  if (el.value.trim()) {
                    store.addTask(plan.id, el.value)
                    el.value = ''
                  }
                }
              "
            />
          </div>
        </div>
      </div>

      <!-- 新建计划弹窗 -->
      <Modal v-if="showCreate" title="新建学习计划" @close="showCreate = false">
        <form class="space-y-4" @submit.prevent="saveCreate">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">计划名称 *</span>
              <input v-model="createForm.title" class="input-trae" placeholder="如：Web 安全专项提升" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">描述</span>
              <input v-model="createForm.description" class="input-trae" placeholder="为什么补、怎么补…" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">任务（每行一个，回车换行）</span>
              <textarea
                v-model="createForm.tasksText"
                class="input-trae min-h-[120px] resize-y py-2.5"
                placeholder="复习 SQL 注入原理&#10;练习 3 道 XSS 攻防题&#10;重构简历项目描述…"
              />
            </label>

            <div class="flex items-center justify-end gap-3 pt-1">
              <SecondaryButton type="button" @click="showCreate = false">取消</SecondaryButton>
              <PrimaryButton type="submit" :disabled="!createForm.title.trim()">创建计划</PrimaryButton>
            </div>
        </form>
      </Modal>
    </div>
  </div>
</template>
