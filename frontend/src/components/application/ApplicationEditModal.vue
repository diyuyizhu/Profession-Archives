<script setup lang="ts">
/**
 * 投递编辑弹窗（B1）：只做编辑（新建统一走 /tracking/collect 全页表单）。
 * - 状态只读：状态机迁移请用看板卡片「推进 / 标记」
 * - a11y：role=dialog + aria-modal、焦点陷阱、Escape 关闭、焦点还原
 * - 表单提交：<form @submit.prevent>，保存失败给出可见反馈
 */
import type { Application, ApplicationPayload, ApplyMethod } from '@pa/shared'
import { APPLY_METHOD_LABELS, APPLY_METHODS } from '@pa/shared'
import { statusMeta } from '@pa/shared/application'
import { parseTags } from '@pa/shared/utils'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'

const props = defineProps<{ app: Application }>()

const emit = defineEmits<{
  save: [payload: ApplicationPayload]
  close: []
}>()

const form = ref({
  company: props.app.company,
  title: props.app.title,
  channel: props.app.channel ?? '',
  url: props.app.url ?? '',
  jd: props.app.jd ?? '',
  apply_method: (props.app.apply_method ?? '') as ApplyMethod | '',
  tagsText: (props.app.tags ?? []).join(', '),
  notes: props.app.notes ?? '',
  total_rounds: props.app.total_rounds ?? 3,
  importance: props.app.importance ?? 3,
  email_thread: props.app.email_thread ?? '',
  reject_reason: props.app.reject_reason ?? '',
  applied_at: props.app.applied_at ?? '',
})

const valid = computed(() => form.value.company.trim() && form.value.title.trim())
const saveError = ref('')

/* ── 焦点管理：进入聚焦首字段，退出还原到触发按钮 ── */
let previousFocus: HTMLElement | null = null

onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  document.getElementById('app-edit-company')?.focus()
})

onBeforeUnmount(() => {
  previousFocus?.focus()
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

function submit(): void {
  if (!valid.value) return
  try {
    emit('save', {
      company: form.value.company.trim(),
      title: form.value.title.trim(),
      channel: form.value.channel.trim() || undefined,
      url: form.value.url.trim() || undefined,
      jd: form.value.jd.trim() || undefined,
      apply_method: form.value.apply_method || undefined,
      status: props.app.status,
      tags: parseTags(form.value.tagsText),
      notes: form.value.notes.trim(),
      total_rounds: form.value.total_rounds,
      importance: form.value.importance,
      email_thread: form.value.email_thread.trim() || undefined,
      reject_reason: props.app.status === 'rejected' ? form.value.reject_reason.trim() || undefined : undefined,
      applied_at: form.value.applied_at || undefined,
    })
  } catch {
    saveError.value = '保存失败：本地存储不可用或已满'
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,6,8,0.72)] p-4 backdrop-blur-sm"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-edit-title"
      class="card-glass max-h-[92vh] w-full max-w-xl overflow-y-auto p-6"
      style="backdrop-filter: blur(28px) saturate(1.6)"
    >
      <div class="mb-5 flex items-center justify-between">
        <h3 id="app-edit-title" class="heading-tight text-[16px] tracking-wide text-[#f5f9fe]">
          编辑投递
        </h3>
        <button
          class="text-[rgba(245,249,254,0.4)] transition-colors hover:text-[#f5f9fe]"
          aria-label="关闭"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <!-- 公司 / 岗位 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">公司 *</span>
            <input id="app-edit-company" v-model="form.company" class="input-trae" placeholder="招聘方公司名称" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">岗位 *</span>
            <input v-model="form.title" class="input-trae" placeholder="如：Web 安全工程师" />
          </label>
        </div>

        <!-- 渠道 / URL -->
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

        <!-- 投递方式 -->
        <label class="block">
          <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">投递方式</span>
          <select v-model="form.apply_method" class="input-trae appearance-none">
            <option value="">未选择</option>
            <option v-for="m in APPLY_METHODS" :key="m" :value="m">
              {{ APPLY_METHOD_LABELS[m] }}
            </option>
          </select>
        </label>

        <!-- 状态：只读（状态机迁移请用看板卡片"推进/标记"） -->
        <div>
          <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">当前状态</span>
          <div class="flex items-center gap-2 py-2">
            <span
              class="rounded-full border px-2.5 py-0.5 text-[12px]"
              :class="[
                statusMeta(app.status, app.total_rounds).chip,
                statusMeta(app.status, app.total_rounds).text,
              ]"
            >
              {{ statusMeta(app.status, app.total_rounds).label }}
            </span>
            <span class="text-[11px] text-[rgba(245,249,254,0.35)]">
              状态变更请在看板卡片上用「推进 / 标记」
            </span>
          </div>
        </div>

        <!-- JD -->
        <label class="block">
          <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">
            JD 全文（B3 匹配与 AI 分析依据）
          </span>
          <textarea
            v-model="form.jd"
            class="input-trae min-h-[120px] resize-y py-3"
            placeholder="粘贴岗位描述…"
          />
        </label>

        <!-- 面试轮数 / 重要性 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">预期面试总轮数</span>
            <select v-model.number="form.total_rounds" class="input-trae appearance-none">
              <option v-for="n in 8" :key="n" :value="n">{{ n }} 轮（第 {{ n }} 轮为终面）</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">重要性（1 最高）</span>
            <select v-model.number="form.importance" class="input-trae appearance-none">
              <option v-for="n in 5" :key="n" :value="n">
                {{ n }} {{ '★'.repeat(n) }}
              </option>
            </select>
          </label>
        </div>

        <!-- 拒绝原因（仅状态为「拒绝」时显示） -->
        <label v-if="app.status === 'rejected'" class="block">
          <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">拒绝原因（F1 统计用）</span>
          <input
            v-model="form.reject_reason"
            class="input-trae"
            placeholder="如：方向不符 / 经验不足 / 技术不匹配"
          />
        </label>

        <!-- 标签 / 投递时间 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">标签（逗号分隔）</span>
            <input v-model="form.tagsText" class="input-trae" placeholder="Web安全, 渗透测试" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">投递日期</span>
            <input v-model="form.applied_at" type="date" class="input-trae" />
          </label>
        </div>

        <!-- 备注 -->
        <label class="block">
          <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">备注</span>
          <textarea
            v-model="form.notes"
            class="input-trae min-h-[70px] resize-y py-3"
            placeholder="联系人、面试安排、进展补充…"
          />
        </label>

        <!-- 校验提示 / 保存错误 -->
        <div class="min-h-[16px] text-[11px]" :class="saveError ? 'text-[#f87171]' : 'text-[rgba(245,249,254,0.3)]'">
          {{ saveError || (valid ? '' : '请至少填写公司与岗位名称') }}
        </div>

        <div class="flex items-center justify-end gap-3">
          <SecondaryButton type="button" @click="emit('close')">取消</SecondaryButton>
          <PrimaryButton type="submit" :disabled="!valid">保存修改</PrimaryButton>
        </div>
      </form>
    </div>
  </div>
</template>
