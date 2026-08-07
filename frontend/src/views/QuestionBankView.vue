<script setup lang="ts">
/**
 * 面经题库（C4）：题目按方向分类沉淀，可检索、可复习。
 * - 来源：面试记录自动沉淀（C1）+ 手动录入
 * - 筛选：关键词 / 分类 / 标签
 */
import type { QuestionBankItem } from '@pa/shared'
import { groupQuestionsByCategory } from '@pa/shared/interview'
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useQuestionBankStore } from '@/stores/questionBank'

const store = useQuestionBankStore()

const search = ref('')
const activeCategory = ref<string | null>(null)
const activeTag = ref<string | null>(null)

/** 手动录入弹窗 */
const showAdd = ref(false)
const addForm = ref({
  question: '',
  answer: '',
  category: '',
  difficulty: 2,
  tagsText: '',
})

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return store.items.filter((item) => {
    if (activeCategory.value && (item.category?.trim() || '未分类') !== activeCategory.value) return false
    if (activeTag.value && !item.tags.includes(activeTag.value)) return false
    if (kw) {
      const hay = `${item.question} ${item.answer ?? ''} ${item.category ?? ''} ${item.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

const groups = computed(() => groupQuestionsByCategory(filtered.value))

/** 展开看答案的题 id */
const expanded = ref<Set<string>>(new Set())
function toggleExpand(id: string): void {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

/** 难度可视化 */
const DIFF_LABELS = ['', '入门', '基础', '进阶', '困难', '极难']
function diffDots(d: number): string {
  return '●'.repeat(Math.max(0, Math.min(5, d)))
}

function openAdd(): void {
  addForm.value = {
    question: '',
    answer: '',
    category: activeCategory.value ?? '',
    difficulty: 2,
    tagsText: '',
  }
  showAdd.value = true
}

function saveAdd(): void {
  if (!addForm.value.question.trim()) return
  store.addItem({
    question: addForm.value.question.trim(),
    answer: addForm.value.answer.trim() || undefined,
    category: addForm.value.category.trim() || '未分类',
    difficulty: addForm.value.difficulty,
    tags: addForm.value.tagsText
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean),
    source: 'manual',
  })
  showAdd.value = false
}

function removeItem(item: QuestionBankItem): void {
  if (window.confirm(`删除题目「${item.question}」？`)) {
    store.removeItem(item.id)
  }
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="C4" title="面经题库" :desc="`${store.total} 题 · 面试自动沉淀 + 手动录入`">
        <PrimaryButton @click="openAdd">＋ 手动录入</PrimaryButton>
      </PageHeader>

      <!-- 筛选 -->
      <section class="card-glass mb-6 space-y-3 p-4" style="backdrop-filter: blur(28px) saturate(1.6)">
        <input v-model="search" class="input-trae" placeholder="搜索题目 / 答案 / 标签…" />
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] text-[rgba(245,249,254,0.4)]">分类</span>
          <button
            class="rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors"
            :class="
              activeCategory === null
                ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]'
                : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.04)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'
            "
            @click="activeCategory = null"
          >
            全部
          </button>
          <button
            v-for="c in store.categories"
            :key="c"
            class="rounded-full border px-2.5 py-0.5 text-[11.5px] transition-colors"
            :class="
              activeCategory === c
                ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]'
                : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.04)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'
            "
            @click="activeCategory = activeCategory === c ? null : c"
          >
            {{ c }}
          </button>
        </div>
        <div v-if="store.tags.length" class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] text-[rgba(245,249,254,0.4)]">标签</span>
          <button
            v-for="t in store.tags"
            :key="t"
            class="rounded px-1.5 py-0.5 text-[11px] transition-colors"
            :class="
              activeTag === t
                ? 'bg-[rgba(50,240,140,0.15)] text-[#32f08c]'
                : 'bg-[rgba(237,239,242,0.05)] text-[rgba(245,249,254,0.5)] hover:text-[#f5f9fe]'
            "
            @click="activeTag = activeTag === t ? null : t"
          >
            #{{ t }}
          </button>
        </div>
      </section>

      <!-- 题目分组 -->
      <section v-if="groups.length" class="space-y-6">
        <div v-for="group in groups" :key="group.category">
          <div class="mb-2 flex items-baseline gap-2">
            <span class="heading-tight text-[14px] text-[#f5f9fe]">{{ group.category }}</span>
            <span class="text-[11px] text-[rgba(245,249,254,0.35)]">{{ group.items.length }} 题</span>
          </div>
          <div class="space-y-2.5">
            <div v-for="item in group.items" :key="item.id" class="card-glass p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[13.5px] font-medium text-[#f5f9fe]">{{ item.question }}</span>
                    <span
                      class="rounded-full border border-[rgba(255,255,255,0.1)] px-1.5 py-px text-[10px] text-[rgba(245,249,254,0.4)]"
                      :title="`难度：${DIFF_LABELS[item.difficulty] ?? ''}`"
                    >
                      {{ diffDots(item.difficulty) }}
                    </span>
                    <span
                      v-if="item.source === 'interview'"
                      class="rounded-full border border-[rgba(56,189,248,0.25)] bg-[rgba(56,189,248,0.06)] px-1.5 py-px text-[10px] text-[#38bdf8]"
                    >
                      面试沉淀
                    </span>
                  </div>
                  <div v-if="item.tags.length" class="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      v-for="t in item.tags"
                      :key="t"
                      class="rounded bg-[rgba(237,239,242,0.06)] px-1.5 py-0.5 text-[10.5px] text-[rgba(245,249,254,0.45)]"
                    >
                      #{{ t }}
                    </span>
                  </div>
                  <div v-if="expanded.has(item.id) && item.answer" class="mt-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] p-3">
                    <div class="mb-1 text-[10.5px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">我的答案</div>
                    <p class="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.65)]">
                      {{ item.answer }}
                    </p>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    class="rounded px-2 py-1 text-[11.5px] text-[rgba(245,249,254,0.45)] transition-colors hover:text-[#32f08c]"
                    @click="toggleExpand(item.id)"
                  >
                    {{ expanded.has(item.id) ? '收起' : '答案' }}
                  </button>
                  <button
                    class="rounded px-2 py-1 text-[11.5px] text-[rgba(245,249,254,0.45)] transition-colors hover:text-[#f87171]"
                    @click="removeItem(item)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        v-else
        class="card-glass px-5 py-12 text-center text-[12.5px] text-[rgba(245,249,254,0.35)]"
      >
        {{ search || activeCategory || activeTag ? '没有匹配的题目' : '题库还是空的，记录面试或手动录入' }}
      </div>

      <!-- 手动录入弹窗 -->
      <Modal v-if="showAdd" title="录入题目" @close="showAdd = false">
        <form class="space-y-4" @submit.prevent="saveAdd">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">题目 *</span>
              <input v-model="addForm.question" class="input-trae" placeholder="面试官问了什么？" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">我的答案</span>
              <textarea
                v-model="addForm.answer"
                class="input-trae min-h-[100px] resize-y py-2.5"
                placeholder="沉淀你的回答思路…"
              />
            </label>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">分类</span>
                <input v-model="addForm.category" class="input-trae" list="qb-categories" placeholder="如：网络安全" />
                <datalist id="qb-categories">
                  <option v-for="c in store.categories" :key="c" :value="c" />
                </datalist>
              </label>
              <label class="block">
                <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">难度（1–5）</span>
                <select v-model.number="addForm.difficulty" class="input-trae appearance-none">
                  <option v-for="n in 5" :key="n" :value="n">
                    {{ n }} · {{ DIFF_LABELS[n] }}
                  </option>
                </select>
              </label>
            </div>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">标签（逗号分隔）</span>
              <input v-model="addForm.tagsText" class="input-trae" placeholder="注入, XSS" />
            </label>

            <div class="flex items-center justify-end gap-3 pt-1">
              <SecondaryButton type="button" @click="showAdd = false">取消</SecondaryButton>
              <PrimaryButton type="submit" :disabled="!addForm.question.trim()">保存</PrimaryButton>
            </div>
        </form>
      </Modal>
    </div>
  </div>
</template>
