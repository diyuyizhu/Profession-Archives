<script setup lang="ts">
/**
 * 特化简历（B3）：选投递 → 按 JD 匹配度重排经历、生成定制 summary → 导出。
 * 当前为本地关键词排序草稿；接入后端 AI 后升级为语义匹配 + 润色管线。
 */
import type { Application } from '@pa/shared'
import { buildResumeDraft } from '@pa/shared/ai'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useProfileStore } from '@/stores/profile'

const appStore = useApplicationStore()
const profileStore = useProfileStore()
const route = useRoute()

const pickedId = ref<string | null>(null)
const draft = ref('')
const summary = ref('')
const feedback = ref('')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

const jdApps = computed<Application[]>(() => appStore.applications.filter((a) => a.jd?.trim()))

const picked = computed(() =>
  pickedId.value ? appStore.applications.find((a) => a.id === pickedId.value) ?? null : null,
)

function generate(): void {
  if (!picked.value?.jd) return
  const r = buildResumeDraft(profileStore.profile, picked.value.jd)
  draft.value = r.markdown
  summary.value = r.summary
}

// 从详情页"生成特化简历"跳入：自动选中该投递并生成草稿（投递方式联动）
onMounted(() => {
  const appId = route.query.app as string | undefined
  if (appId && appStore.applications.some((a) => a.id === appId && a.jd?.trim())) {
    pickedId.value = appId
    generate()
  }
})

async function copy(): Promise<void> {
  if (!draft.value) return
  try {
    await navigator.clipboard.writeText(draft.value)
    flash('已复制到剪贴板')
  } catch {
    flash('复制失败，请手动选择复制')
  }
}

function download(): void {
  if (!draft.value) return
  const blob = new Blob([draft.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${picked.value?.company ?? 'resume'}-特化简历.md`
  a.click()
  URL.revokeObjectURL(url)
  flash('已下载 Markdown 文件')
}

function flash(msg: string): void {
  feedback.value = msg
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 3200)
}

/* ── 导出 PDF：浏览器打印（无需额外依赖）── */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 极简 Markdown → HTML（### 标题 / **加粗** / 段落 / 空行） */
function mdToHtml(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (/^#{3}\s/.test(line)) return `<h3>${esc(line.replace(/^#{3}\s/, ''))}</h3>`
      if (/^##\s/.test(line)) return `<h2>${esc(line.replace(/^##\s/, ''))}</h2>`
      if (/^#\s/.test(line)) return `<h1>${esc(line.replace(/^#\s/, ''))}</h1>`
      if (!line.trim()) return ''
      return `<p>${esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`
    })
    .join('\n')
}

function exportPdf(): void {
  if (!draft.value) return
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(picked.value?.company ?? '')} 特化简历</title>
<style>
  body { font-family:'Noto Sans SC','Microsoft YaHei',sans-serif; color:#111; max-width:720px; margin:24px auto; padding:0 24px; line-height:1.7; }
  h1 { font-size:22px; border-bottom:2px solid #111; padding-bottom:8px; }
  h2 { font-size:16px; margin-top:20px; border-bottom:1px solid #ccc; padding-bottom:4px; }
  h3 { font-size:14px; margin-bottom:2px; }
  p { margin:6px 0; }
  strong { color:#000; }
  @media print { body { margin:0; } }
</style>
</head>
<body>${mdToHtml(draft.value)}</body>
</html>`
  // 注意：不能带 noopener（会让 window.open 返回 null，导出永不生效）。
  // 新窗口内容是我们生成的本地 HTML，无跨源操作风险。
  const w = window.open('', '_blank')
  if (!w) {
    flash('导出失败：请允许弹窗后重试')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // 等待渲染后弹出打印对话框（用户选择"另存为 PDF"）
  w.setTimeout(() => w.print(), 120)
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <PageHeader code="B3" title="特化简历" desc="按 JD 匹配度重排经历 · 生成定制 summary">
        <PrimaryButton :disabled="!jdApps.length || !pickedId" @click="generate">生成草稿</PrimaryButton>
      </PageHeader>

      <!-- 选投递 -->
      <section class="card-glass p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-[12.5px] text-[rgba(245,249,254,0.5)]">针对投递：</span>
          <select v-model="pickedId" class="input-trae h-9 w-auto min-w-[220px] appearance-none text-[12.5px]">
            <option :value="null" disabled>选择有 JD 的投递…</option>
            <option v-for="app in jdApps" :key="app.id" :value="app.id">
              {{ app.company }} · {{ app.title }}
            </option>
          </select>
          <span v-if="!jdApps.length" class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
            暂无带 JD 的投递，先采集岗位并填写 JD
          </span>
          <span v-else class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
            经历将按与 JD 的关键词重合度排序
          </span>
        </div>

        <div v-if="feedback" class="mt-3 text-[12.5px] text-[#60f2bd]">✓ {{ feedback }}</div>
      </section>

      <!-- 草稿 -->
      <section v-if="draft" class="card-glass mt-5 p-5" style="backdrop-filter: blur(28px) saturate(1.6)">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-[13px] font-semibold text-[#f5f9fe]">
            草稿 · {{ picked?.company }} {{ picked?.title }}
          </span>
          <span class="text-[11px] text-[rgba(245,249,254,0.35)]">可编辑后复制 / 下载</span>
        </div>

        <textarea v-model="draft" class="input-trae min-h-[420px] resize-y py-3 font-mono text-[12.5px] leading-relaxed" />

        <!-- 定制 summary 独立展示 -->
        <div v-if="summary" class="mt-3 rounded-lg border border-[rgba(50,240,140,0.15)] bg-[rgba(50,240,140,0.04)] p-3">
          <div class="mb-1 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.4)]">
            定制个人简介（已内置在草稿「个人简介」段）
          </div>
          <p class="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.7)]">
            {{ summary }}
          </p>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <SecondaryButton @click="copy">复制 Markdown</SecondaryButton>
          <SecondaryButton @click="download">下载 .md</SecondaryButton>
          <SecondaryButton @click="exportPdf">导出 PDF（打印）</SecondaryButton>
          <span class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
            PDF 由浏览器打印生成 · Word 后续接入
          </span>
        </div>
      </section>

      <div
        v-else
        class="card-glass mt-5 flex flex-col items-center gap-2 px-5 py-14 text-center"
      >
        <span class="text-3xl">📄</span>
        <div class="text-[13px] text-[rgba(245,249,254,0.6)]">选择一个投递，生成针对其 JD 的特化简历草稿</div>
        <div class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
          经历按 JD 关键词重合度排序 · 定制 summary · Markdown 导出
        </div>
      </div>
    </div>
  </div>
</template>
