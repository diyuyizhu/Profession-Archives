<script setup lang="ts">
/**
 * 面试记录（C1 + C2）：选择投递 → 按轮次记录面试。
 * - 记录结果自动推进投递看板（通过→推进 / 淘汰→拒绝 / 待定→不动 / 终态→不动）
 * - 题目可一键沉淀到面经题库（C4，按题目方向分类，去重）
 */
import type { Application, ApplicationStatus, InterviewResult, InterviewType } from '@pa/shared'
import { INTERVIEW_RESULT_LABELS, INTERVIEW_TYPE_LABELS } from '@pa/shared'
import { statusMeta } from '@pa/shared/application'
import { classifyQuestionCategory } from '@pa/shared/interview'
import { computed, ref } from 'vue'

import ApplicationPicker from '@/components/application/ApplicationPicker.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useInterviewStore } from '@/stores/interview'
import { useQuestionBankStore } from '@/stores/questionBank'

const appStore = useApplicationStore()
const interviewStore = useInterviewStore()
const questionBank = useQuestionBankStore()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'record', label: '面试记录', path: '/interview' },
  { id: 'review', label: 'AI 复盘', path: '/interview/review' },
  { id: 'bank', label: '面经题库', path: '/interview/question-bank' },
]

/** 当前选中的投递 */
const selectedId = ref<string | null>(null)

/** 可选投递：正在面试流程中的（未终态）优先，其余排后 */
const candidates = computed(() =>
  [...appStore.applications].sort((a, b) => {
    const ta = statusMeta(a.status).terminal ? 1 : 0
    const tb = statusMeta(b.status).terminal ? 1 : 0
    return ta - tb || (a.updated_at < b.updated_at ? 1 : -1)
  }),
)

const selected = computed(() =>
  selectedId.value ? appStore.applications.find((a) => a.id === selectedId.value) ?? null : null,
)
const interviews = computed(() =>
  selectedId.value ? interviewStore.interviewsOf(selectedId.value) : [],
)
/** 下一轮序号（与 store 同一口径：max(round)+1，避免删除中间轮后标签错位） */
const nextRound = computed(() =>
  selectedId.value ? interviewStore.nextRoundFor(selectedId.value) : 1,
)

/* ── 记录表单 ── */
const showForm = ref(false)
const form = ref({
  occurred_at: new Date().toISOString().slice(0, 10),
  interview_type: 'video' as InterviewType,
  interviewer: '',
  result: 'pending' as InterviewResult,
  self_rating: 3,
  notes: '',
  toBank: true,
  qa: [] as Array<{ question: string; answer: string }>,
})

/** 提示信息（aria-live 供读屏播报） */
const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined
function notify(msg: string): void {
  flash.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = ''), 3200)
}

function resetForm(): void {
  form.value = {
    occurred_at: new Date().toISOString().slice(0, 10),
    interview_type: 'video',
    interviewer: '',
    result: 'pending',
    self_rating: 3,
    notes: '',
    toBank: true,
    qa: [],
  }
}

function selectApp(id: string): void {
  selectedId.value = id
  showForm.value = false
  resetForm()
}

function addQa(): void {
  form.value.qa.push({ question: '', answer: '' })
}

function removeQa(i: number): void {
  form.value.qa.splice(i, 1)
}

/** 保存一轮面试：入库 → C2 流转 → 可选沉淀题库（去重） */
function save(): void {
  if (!selectedId.value) return
  const { interview, statusChanged, newStatus } = interviewStore.recordInterview(selectedId.value, {
    occurred_at: form.value.occurred_at,
    interview_type: form.value.interview_type,
    interviewer: form.value.interviewer.trim() || undefined,
    result: form.value.result,
    self_rating: form.value.self_rating,
    notes: form.value.notes.trim() || undefined,
    qa: form.value.qa
      .filter((q) => q.question.trim())
      .map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })),
  })

  // C4：沉淀题目到面经题库（按题目方向分类；已存在的题目跳过）
  if (form.value.toBank) {
    for (const qa of interview.qa) {
      // 只按题目文本去重；不能按 interview_id —— 否则同一面试的多题只剩第一题
      const exists = questionBank.items.some((i) => i.question === qa.question)
      if (exists) continue
      // 难度语义：答得好（自评高）→ 题偏易标低；难住我了 → 标高
      const difficulty = form.value.self_rating >= 4 ? 2 : form.value.self_rating <= 2 ? 4 : 3
      questionBank.addItem({
        question: qa.question,
        answer: qa.answer || undefined,
        category: classifyQuestionCategory(qa.question),
        industry: selected.value?.tags[0] || undefined,
        difficulty,
        tags: selected.value?.tags ?? [],
        source: 'interview',
        interview_id: interview.id,
      })
    }
  }

  const statusMsg =
    statusChanged && newStatus
      ? ` · 看板已自动${INTERVIEW_RESULT_LABELS[form.value.result] === '通过' ? '推进' : '更新'}为「${statusMeta(newStatus as ApplicationStatus).label}」`
      : ''
  notify(`已记录第 ${interview.round} 轮面试${statusMsg}`)
  resetForm()
  showForm.value = false
}

/** 星级输入 */
function setRating(n: number): void {
  form.value.self_rating = n
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-16">
      <PageHeader code="C1/C2" title="面试记录" desc="记录轮次 · 结果自动推进看板" />

      <ModuleTabs :tabs="tabs" />

      <!-- 提示条（读屏播报） -->
      <div
        v-if="flash"
        role="status"
        aria-live="polite"
        class="card-glass fixed left-1/2 top-20 z-50 -translate-x-1/2 px-5 py-3 text-[13px] text-[#60f2bd]"
      >
        {{ flash }}
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <!-- 左：投递列表 -->
        <ApplicationPicker
          :candidates="candidates"
          :selected-id="selectedId"
          :meta-for="
            (app) => `面试 ${interviewStore.interviewsOf(app.id).length} 轮`
          "
          @select="selectApp"
        />

        <!-- 右：面试详情 -->
        <section class="min-w-0">
          <!-- 未选择 -->
          <div
            v-if="!selected"
            class="card-glass flex h-[300px] flex-col items-center justify-center gap-3 text-center"
          >
            <span class="text-3xl">🎯</span>
            <div class="text-[14px] text-[rgba(245,249,254,0.6)]">从左侧选择一个投递开始记录</div>
            <div class="text-[12px] text-[rgba(245,249,254,0.35)]">
              每一轮结果都会自动推进看板状态
            </div>
          </div>

          <div v-else class="space-y-4">
            <!-- 投递摘要 -->
            <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="heading-tight text-[17px] text-[#f5f9fe]">{{ selected.title }}</div>
                  <div class="mt-0.5 text-[12.5px] text-[rgba(245,249,254,0.5)]">
                    {{ selected.company }}<span v-if="selected.channel"> · {{ selected.channel }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-full border px-2.5 py-1 text-[12px]"
                    :class="[
                      statusMeta(selected.status, selected.total_rounds).chip,
                      statusMeta(selected.status, selected.total_rounds).text,
                    ]"
                  >
                    {{ statusMeta(selected.status, selected.total_rounds).label }}
                  </span>
                  <PrimaryButton v-if="!showForm" @click="showForm = true">
                    记录第 {{ nextRound }} 轮
                  </PrimaryButton>
                </div>
              </div>
            </div>

            <!-- 新轮次表单 -->
            <div v-if="showForm" class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
              <div class="mb-4 flex items-center justify-between">
                <span class="text-[13px] font-semibold text-[#f5f9fe]">第 {{ nextRound }} 轮面试</span>
                <SecondaryButton @click="showForm = false">收起</SecondaryButton>
              </div>

              <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <label class="block">
                    <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">日期 *</span>
                    <input v-model="form.occurred_at" type="date" class="input-trae" />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">形式</span>
                    <select v-model="form.interview_type" class="input-trae appearance-none">
                      <option v-for="(label, key) in INTERVIEW_TYPE_LABELS" :key="key" :value="key">
                        {{ label }}
                      </option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">面试官</span>
                    <input v-model="form.interviewer" class="input-trae" placeholder="姓名 / 角色" />
                  </label>
                  <label class="block">
                    <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">结果</span>
                    <select v-model="form.result" class="input-trae appearance-none">
                      <option v-for="(label, key) in INTERVIEW_RESULT_LABELS" :key="key" :value="key">
                        {{ label }}
                      </option>
                    </select>
                  </label>
                </div>

                <!-- 自评 -->
                <div class="flex flex-wrap items-center gap-3">
                  <span class="text-xs text-[rgba(245,249,254,0.55)]" id="self-rating-label">自评</span>
                  <div class="flex gap-1" role="group" aria-labelledby="self-rating-label">
                    <button
                      v-for="n in 5"
                      :key="n"
                      type="button"
                      class="text-xl transition-transform hover:scale-110"
                      :aria-pressed="n <= form.self_rating"
                      :aria-label="`${n} 分（共 5 分）`"
                      :class="n <= form.self_rating ? 'opacity-100' : 'opacity-25 grayscale'"
                      @click="setRating(n)"
                    >
                      ⭐
                    </button>
                  </div>
                  <span class="font-mono text-[11px] text-[rgba(245,249,254,0.4)]">
                    {{ form.self_rating }}/5
                  </span>
                </div>

                <!-- 题目与回答 -->
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-xs text-[rgba(245,249,254,0.55)]">题目与我的回答（可多题）</span>
                    <button
                      class="rounded-full border border-[rgba(50,240,140,0.35)] bg-[rgba(50,240,140,0.08)] px-2.5 py-0.5 text-[11px] text-[#32f08c]"
                      @click="addQa"
                    >
                      ＋ 添加题目
                    </button>
                  </div>
                  <div v-if="form.qa.length" class="space-y-2">
                    <div
                      v-for="(qa, i) in form.qa"
                      :key="i"
                      class="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(237,239,242,0.04)] p-3"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-medium text-[rgba(245,249,254,0.5)]">#{{ i + 1 }}</span>
                        <button
                          class="text-[11px] text-[rgba(245,249,254,0.35)] hover:text-[#f87171]"
                          @click="removeQa(i)"
                        >
                          移除
                        </button>
                      </div>
                      <input
                        v-model="qa.question"
                        class="input-trae mt-1.5"
                        :aria-label="`第 ${i + 1} 题题目`"
                        placeholder="面试官问了什么？"
                      />
                      <textarea
                        v-model="qa.answer"
                        class="input-trae mt-2 min-h-[52px] resize-y py-2 text-[12.5px]"
                        :aria-label="`第 ${i + 1} 题我的回答`"
                        placeholder="我的回答 / 卡壳点…"
                      />
                    </div>
                  </div>
                  <div
                    v-else
                    class="rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] px-3 py-4 text-center text-[11.5px] text-[rgba(245,249,254,0.3)]"
                  >
                    暂无题目，可点「＋ 添加题目」记录
                  </div>
                </div>

                <label class="block">
                  <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">备注 / 感受</span>
                  <textarea
                    v-model="form.notes"
                    class="input-trae min-h-[60px] resize-y py-2.5"
                    placeholder="面试氛围、考察重点、自我感受…"
                  />
                </label>

                <!-- 沉淀题库 -->
                <label class="flex cursor-pointer items-center gap-2.5">
                  <input v-model="form.toBank" type="checkbox" class="h-4 w-4 accent-[#32f08c]" />
                  <span class="text-[12.5px] text-[rgba(245,249,254,0.7)]">
                    本题自动沉淀到面经题库（C4，重复题目跳过）
                  </span>
                </label>
              </div>

              <div class="mt-5 flex items-center justify-end gap-3">
                <SecondaryButton @click="showForm = false">取消</SecondaryButton>
                <PrimaryButton @click="save">保存本轮面试</PrimaryButton>
              </div>
            </div>

            <!-- 已有面试列表 -->
            <div v-if="interviews.length" class="space-y-3">
              <div
                v-for="interview in [...interviews].reverse()"
                :key="interview.id"
                class="card-glass p-5"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class="rounded-full border border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.08)] px-2 py-0.5 font-mono text-[11px] text-[#32f08c]"
                    >
                      第 {{ interview.round }} 轮
                    </span>
                    <span class="font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                      {{ interview.occurred_at }}
                    </span>
                    <span class="text-[11px] text-[rgba(245,249,254,0.4)]">
                      {{ INTERVIEW_TYPE_LABELS[interview.interview_type] }}
                    </span>
                    <span v-if="interview.interviewer" class="text-[11px] text-[rgba(245,249,254,0.4)]">
                      面试官：{{ interview.interviewer }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-[rgba(245,249,254,0.4)]">
                      ⭐ {{ interview.self_rating }}/5
                    </span>
                    <span
                      class="rounded-full border px-2 py-0.5 text-[11px]"
                      :class="
                        interview.result === 'passed'
                          ? 'border-[rgba(50,240,140,0.4)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]'
                          : interview.result === 'failed'
                            ? 'border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] text-[#f87171]'
                            : 'border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)] text-[#fbbf24]'
                      "
                    >
                      {{ INTERVIEW_RESULT_LABELS[interview.result] }}
                    </span>
                  </div>
                </div>

                <!-- 题目 -->
                <div v-if="interview.qa.length" class="mt-3 space-y-2">
                  <div
                    v-for="(qa, i) in interview.qa"
                    :key="i"
                    class="rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2.5"
                  >
                    <div class="text-[13px] text-[#f5f9fe]">{{ qa.question }}</div>
                    <p v-if="qa.answer" class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                      {{ qa.answer }}
                    </p>
                  </div>
                </div>

                <p v-if="interview.notes" class="mt-2.5 text-[12px] text-[rgba(245,249,254,0.45)]">
                  {{ interview.notes }}
                </p>

                <div class="mt-2.5 flex items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-2.5">
                  <button
                    class="text-[11px] text-[rgba(245,249,254,0.35)] transition-colors hover:text-[#f87171]"
                    @click="interviewStore.removeInterview(interview.id)"
                  >
                    删除本轮
                  </button>
                </div>
              </div>
            </div>

            <div
              v-else
              class="card-glass px-5 py-10 text-center text-[12.5px] text-[rgba(245,249,254,0.35)]"
            >
              还没有面试记录，点击右上角「记录第 {{ nextRound }} 轮」
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
