<script setup lang="ts">
/**
 * 岗位采集（B2）：URL 直采 / 手动录入入口。
 * - 后端就绪后：粘贴 URL 可自动抓取标题/公司/JD；插件采集走本地桥（D 模块）
 * - 当前 localStorage 版：手动录入 + 可选"直接标记已投"
 */
import type { ApplicationPayload, ApplyMethod } from '@pa/shared'
import { APPLY_METHOD_DESC, APPLY_METHOD_LABELS, APPLY_METHODS } from '@pa/shared'
import { looksLikeInterviewEmail, parseEmailForApplication, type EmailParseResult } from '@pa/shared/email'
import { localToday, parseTags } from '@pa/shared/utils'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'

const store = useApplicationStore()
const router = useRouter()

const form = ref({
  company: '',
  title: '',
  channel: '',
  url: '',
  jd: '',
  apply_method: '' as ApplyMethod | '',
  applied: false,
  applied_at: '',
  tagsText: '',
  notes: '',
})

/** 提交反馈：成功 / 失败文案 */
const feedback = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

/* ── 邮箱导入：粘贴邮件 → 解析 → 预填表单 ── */
const showEmailImport = ref(false)
const emailText = ref('')
const emailResult = ref<EmailParseResult | null>(null)
const emailNote = ref('')

function parseEmail(): void {
  if (!emailText.value.trim()) return
  const r = parseEmailForApplication(emailText.value)
  emailResult.value = r
  if (!looksLikeInterviewEmail(emailText.value) && r.confidence < 0.5) {
    emailNote.value = '这看起来不太像招聘面试邮件，解析结果可能不准，请核对'
  } else {
    emailNote.value = ''
  }
}

/** 把解析结果预填到采集表单 */
function applyEmailToForm(): void {
  const r = emailResult.value
  if (!r) return
  if (r.company) form.value.company = r.company
  if (r.title) form.value.title = r.title
  if (r.platform) form.value.channel = r.platform
  form.value.applied = true
  if (r.date) form.value.applied_at = r.date
  const noteParts: string[] = []
  if (r.date) noteParts.push(`面试/投递日期：${r.date}${r.time ? ` ${r.time}` : ''}`)
  if (r.lines.length) noteParts.push('邮件摘要：' + r.lines[0])
  if (noteParts.length) form.value.notes = noteParts.join('\n')
  showEmailImport.value = false
  emailText.value = ''
  emailResult.value = null
}

/** 提交防抖：避免双击/回车连点产生重复投递 */
const submitting = ref(false)

function submit(): void {
  if (submitting.value) return
  if (!form.value.company.trim() || !form.value.title.trim()) return
  const payload: ApplicationPayload = {
    company: form.value.company.trim(),
    title: form.value.title.trim(),
    channel: form.value.channel.trim() || undefined,
    url: form.value.url.trim() || undefined,
    jd: form.value.jd.trim() || undefined,
    apply_method: form.value.apply_method || undefined,
    status: form.value.applied ? 'applied' : 'backlog',
    tags: parseTags(form.value.tagsText),
    notes: form.value.notes.trim(),
    applied_at:
      form.value.applied_at || (form.value.applied ? localToday() : undefined),
  }
  submitting.value = true
  try {
    store.addApplication(payload)
    feedback.value = { kind: 'ok', text: '已采集入库，跳转看板…' }
    setTimeout(() => router.push('/tracking/board'), 400)
  } catch {
    submitting.value = false
    feedback.value = {
      kind: 'error',
      text: '保存失败：本地存储不可用或已满，请清理后重试',
    }
  }
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-2xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="B2" title="采集岗位" desc="粘贴岗位 URL 与 JD，入库投递看板">
        <SecondaryButton @click="router.push('/tracking/board')">返回看板</SecondaryButton>
      </PageHeader>

      <!-- 采集方式提示 -->
      <section class="card-glass mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        <div class="flex items-start gap-3">
          <span class="text-lg">🔗</span>
          <div>
            <div class="text-[13px] font-semibold text-[#f5f9fe]">URL 直采</div>
            <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
              粘贴 URL，后端抓取标题与 JD
            </div>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-lg">🧩</span>
          <div>
            <div class="text-[13px] font-semibold text-[#f5f9fe]">插件采集</div>
            <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
              岗位页点插件一键入库（D 模块）
            </div>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-lg">✍️</span>
          <div>
            <div class="text-[13px] font-semibold text-[#f5f9fe]">手动录入</div>
            <div class="mt-0.5 text-[11.5px] text-[rgba(245,249,254,0.45)]">
              下方表单直接填写
            </div>
          </div>
        </div>
      </section>

      <!-- 邮箱导入 -->
      <section class="card-glass mb-6 p-4" style="backdrop-filter: blur(28px) saturate(1.6)">
        <details :open="showEmailImport" @toggle="showEmailImport = ($event.target as HTMLDetailsElement).open">
          <summary class="cursor-pointer text-[13px] font-medium text-[#32f08c]">
            📧 从招聘邮件导入（粘贴邮件内容 → AI 预填看板）
          </summary>
          <div class="mt-3 space-y-3">
            <textarea
              v-model="emailText"
              class="input-trae min-h-[120px] resize-y py-3"
              placeholder="粘贴招聘/面试邮件全文（含公司、岗位、时间信息）…"
            />
            <div class="flex items-center gap-2">
              <SecondaryButton :disabled="!emailText.trim()" @click="parseEmail">解析邮件</SecondaryButton>
              <span v-if="emailNote" class="text-[11.5px] text-[#fbbf24]">{{ emailNote }}</span>
            </div>

            <!-- 解析结果 -->
            <div v-if="emailResult" class="rounded-lg border border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.05)] p-3">
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                <span>公司：<b class="text-[#f5f9fe]">{{ emailResult.company || '—' }}</b></span>
                <span>岗位：<b class="text-[#f5f9fe]">{{ emailResult.title || '—' }}</b></span>
                <span>日期：<b class="text-[#f5f9fe]">{{ emailResult.date || '—' }}{{ emailResult.time ? ' ' + emailResult.time : '' }}</b></span>
                <span>平台：<b class="text-[#f5f9fe]">{{ emailResult.platform || '—' }}</b></span>
                <span>置信度：<b class="text-[#f5f9fe]">{{ Math.round(emailResult.confidence * 100) }}%</b></span>
              </div>
              <div v-if="emailResult.lines.length" class="mt-2 space-y-0.5 text-[11.5px] text-[rgba(245,249,254,0.5)]">
                <div v-for="(l, i) in emailResult.lines" :key="i">▸ {{ l }}</div>
              </div>
              <div class="mt-3 flex justify-end">
                <PrimaryButton @click="applyEmailToForm">填入采集表单 →</PrimaryButton>
              </div>
            </div>
          </div>
        </details>
      </section>

      <!-- 表单 -->
      <section class="card-glass p-6" style="backdrop-filter: blur(28px) saturate(1.6)">
        <form class="space-y-4" @submit.prevent="submit">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">公司 *</span>
              <input v-model="form.company" class="input-trae" placeholder="招聘方公司名称" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">岗位 *</span>
              <input v-model="form.title" class="input-trae" placeholder="如：Web 安全工程师" />
            </label>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">渠道</span>
              <input v-model="form.channel" class="input-trae" placeholder="官网 / BOSS 直聘 / 内推…" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">岗位 URL</span>
              <input v-model="form.url" class="input-trae" placeholder="https://…" />
            </label>
          </div>

          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">
              JD 全文（自动入库 · 供 B3 匹配与复盘）
            </span>
            <textarea
              v-model="form.jd"
              class="input-trae min-h-[140px] resize-y py-3"
              placeholder="粘贴岗位描述，越完整，简历匹配与 AI 复盘越准…"
            />
          </label>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">标签（逗号分隔）</span>
              <input v-model="form.tagsText" class="input-trae" placeholder="Web安全, 渗透测试" />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">备注</span>
              <input v-model="form.notes" class="input-trae" placeholder="内推人、联系人…" />
            </label>
          </div>

          <!-- 投递方式 -->
          <div>
            <div class="mb-2 text-xs text-[rgba(245,249,254,0.55)]">
              投递方式（决定下一步动作：插件填充 / 简历模板 / 邮箱导入）
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="m in APPLY_METHODS"
                :key="m"
                type="button"
                class="rounded-lg border px-3 py-1.5 text-[12px] transition-colors"
                :class="
                  form.apply_method === m
                    ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-[#32f08c]'
                    : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'
                "
                @click="form.apply_method = m"
              >
                {{ APPLY_METHOD_LABELS[m] }}
              </button>
            </div>
            <div v-if="form.apply_method" class="mt-2 text-[11.5px] leading-relaxed text-[rgba(245,249,254,0.5)]">
              {{ APPLY_METHOD_DESC[form.apply_method] }}
              <span v-if="form.apply_method === 'official_form'"> · 保存后可去「特化简历」生成对应模板草稿，或调插件填充</span>
              <span v-if="form.apply_method === 'email'"> · 上方「邮箱导入」可一键预填本表单</span>
              <span v-if="form.apply_method === 'ats'"> · 平台内投递后可用插件采集岗位/回传看板</span>
            </div>
          </div>

          <!-- 直接标记已投 -->
          <label class="flex cursor-pointer items-center gap-3">
            <input v-model="form.applied" type="checkbox" class="h-4 w-4 accent-[#32f08c]" />
            <span class="text-[13px] text-[rgba(245,249,254,0.75)]">
              已投出（直接标记「已投」，否则进入备选池）
            </span>
          </label>

          <!-- 实时校验 -->
          <div class="min-h-[16px] text-[11px] text-[rgba(245,249,254,0.3)]">
            {{
              form.company.trim() && form.title.trim()
                ? ''
                : '请至少填写公司与岗位名称'
            }}
          </div>

        <!-- 提交反馈 -->
        <div
          v-if="feedback"
          class="text-[12px]"
          :class="feedback.kind === 'ok' ? 'text-[#60f2bd]' : 'text-[#f87171]'"
        >
          {{ feedback.text }}
        </div>

        <div class="mt-2 flex items-center justify-end gap-3">
          <SecondaryButton @click="router.push('/tracking/board')">取消</SecondaryButton>
          <PrimaryButton
            type="submit"
            :disabled="!(form.company.trim() && form.title.trim())"
          >
            {{ form.applied ? '采集并标记已投' : '采集 · 加入备选池' }}
          </PrimaryButton>
        </div>
        </form>
      </section>

      <!-- 插件提示 -->
      <div class="mt-4 text-center text-[11px] text-[rgba(245,249,254,0.3)]">
        浏览器插件（岗位采集 + 表单填充）在模块 D 阶段接入 · 已登录站点的采集将自动复用浏览器会话
      </div>
    </div>
  </div>
</template>
