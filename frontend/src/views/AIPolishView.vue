<script setup lang="ts">
/**
 * 简历润色（E2 / B3）：逐段优化措辞、强化 JD 关键词。
 * 当前为本地启发式（格式归一 + JD 关键词覆盖检测），接入后端 AI 后升级为模型润色。
 */
import { polishResume } from '@pa/shared/ai'
import { ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'

const input = ref('')
const jd = ref('')
const result = ref<{ text: string; suggestions: string[] } | null>(null)
const copied = ref(false)
const copyError = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

function run(): void {
  result.value = polishResume(input.value, jd.value.trim() || undefined)
}

async function copy(): Promise<void> {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value.text)
    copied.value = true
    copyError.value = ''
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
    copyError.value = '复制失败，请手动选择复制'
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copyError.value = ''), 3200)
  }
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <PageHeader code="E2" title="简历润色" desc="逐段优化措辞 · 强化 JD 关键词" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- 左：输入 -->
        <section class="card-glass h-fit p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
          <label class="block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">简历正文</span>
            <textarea
              v-model="input"
              class="input-trae min-h-[240px] resize-y py-3"
              placeholder="粘贴简历经历 / 项目描述…（每段用空行分隔）"
            />
          </label>
          <label class="mt-4 block">
            <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">
              目标 JD（可选，用于关键词强化建议）
            </span>
            <textarea
              v-model="jd"
              class="input-trae min-h-[90px] resize-y py-3"
              placeholder="粘贴岗位描述，帮助检查关键词覆盖…"
            />
          </label>

          <div class="mt-4 flex items-center justify-end">
            <PrimaryButton :disabled="!input.trim()" @click="run">开始润色</PrimaryButton>
          </div>
        </section>

        <!-- 右：结果 -->
        <section class="min-w-0">
          <div class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-[13px] font-semibold text-[#f5f9fe]">润色结果</span>
              <span class="text-[11px] text-[rgba(245,249,254,0.35)]">本地启发式 · 可编辑</span>
            </div>

            <div v-if="!result" class="px-2 py-12 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
              左侧粘贴简历并点击「开始润色」
            </div>

            <div v-else>
              <textarea
                v-model="result.text"
                class="input-trae min-h-[240px] resize-y py-3"
              />

              <!-- 建议 -->
              <div class="mt-3">
                <div class="mb-1.5 text-[11.5px] font-medium text-[rgba(245,249,254,0.4)]">润色建议</div>
                <ul class="space-y-1">
                  <li
                    v-for="(s, i) in result.suggestions"
                    :key="i"
                    class="flex items-start gap-2 text-[12.5px] text-[rgba(245,249,254,0.65)]"
                  >
                    <span class="mt-0.5 text-[#32f08c]">▸</span>{{ s }}
                  </li>
                </ul>
              </div>

              <div class="mt-4 flex items-center gap-3">
                <SecondaryButton @click="copy">
                  {{ copied ? '✓ 已复制' : '复制结果' }}
                </SecondaryButton>
                <span
                  v-if="copied"
                  role="status"
                  aria-live="polite"
                  class="text-[12px] text-[#60f2bd]"
                >
                  已复制
                </span>
                <span
                  v-if="copyError"
                  role="alert"
                  aria-live="assertive"
                  class="text-[12px] text-[#f87171]"
                >
                  {{ copyError }}
                </span>
                <span class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
                  可粘贴回简历编辑器 / 导出
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
