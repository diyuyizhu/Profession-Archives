<script setup lang="ts">
/**
 * 简历导入（E）：上传/粘贴简历文本 → AI 解析 → 写入档案。
 * 覆盖前弹选择（覆盖 / 合并 / 取消）；同时把解析结果复刻一份「基础简历」挂到简历树根。
 */
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { parseResume, type ParsedResume } from '@/lib/aiClient'
import { useProfileStore } from '@/stores/profile'
import { useResumeTreeStore } from '@/stores/resumeTree'

const profileStore = useProfileStore()
const resumeTree = useResumeTreeStore()

/** 模块内 Tab */
const tabs: ModuleTab[] = [
  { id: 'extract', label: '素材提炼', path: '/ai' },
  { id: 'import', label: '简历导入', path: '/ai/import' },
  { id: 'polish', label: '简历润色', path: '/ai/polish' },
  { id: 'match', label: 'JD 匹配', path: '/ai/match' },
]

const resumeText = ref('')
const parsing = ref(false)
const parsed = ref<ParsedResume | null>(null)
const msg = ref('')
const showConfirm = ref(false)

const hasProfileContent = computed(() => !profileStore.isEmpty)

/** 从文件读取简历文本 */
function onPickFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    resumeText.value = String(reader.result ?? '')
    parsed.value = null
  }
  reader.readAsText(file)
  input.value = ''
}

async function doParse(): Promise<void> {
  if (!resumeText.value.trim()) {
    msg.value = '请先粘贴或上传简历文本'
    return
  }
  parsing.value = true
  msg.value = ''
  parsed.value = null
  try {
    parsed.value = await parseResume(resumeText.value.trim())
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '解析失败'
  } finally {
    parsing.value = false
  }
}

function openWrite(): void {
  if (hasProfileContent.value) showConfirm.value = true
  else writeArchive('merge')
}

function writeArchive(mode: 'merge' | 'overwrite'): void {
  if (!parsed.value) return
  try {
    profileStore.importResume(parsed.value, mode)
    // 复刻基础简历到简历树根（内容 = 原文，atom_ids = 档案原子 id）
    const p = profileStore.profile
    const atomIds = [
      ...p.skills.map((s) => s.id),
      ...p.experiences.map((e) => e.id),
      ...p.projects.map((pr) => pr.id),
      ...p.education.map((ed) => ed.id),
    ]
    if (resumeTree.baseResume) {
      // 已有基础简历：更新内容与原子引用
      resumeTree.baseResume.content_md = resumeText.value.trim()
      resumeTree.baseResume.atom_ids = atomIds
    } else {
      resumeTree.addNode({
        title: '基础简历',
        parent_id: null,
        kind: 'base',
        content_md: resumeText.value.trim(),
        atom_ids: atomIds,
      })
    }
    showConfirm.value = false
    msg.value = '已写入档案并复刻基础简历到简历树'
    setTimeout(() => (msg.value = ''), 4000)
  } catch (e) {
    msg.value = e instanceof Error ? e.message : '写入失败'
  }
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <PageHeader code="E2" title="简历导入" desc="上传/粘贴简历 → AI 解析 → 自动写入档案" back-to="/resume" />

      <ModuleTabs :tabs="tabs" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <!-- 左：输入 -->
        <section class="card-glass h-fit p-5">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[13px] font-semibold text-neutral-900">简历文本</span>
            <label class="cursor-pointer text-[11.5px] text-neutral-900 hover:underline">
              上传 .txt/.md
              <input type="file" accept=".txt,.md,.text,text/plain" class="hidden" @change="onPickFile" />
            </label>
          </div>
          <textarea
            v-model="resumeText"
            class="input-trae min-h-[280px] resize-y py-2.5 text-[12.5px] leading-relaxed"
            placeholder="粘贴简历全文（姓名、技能、经历、项目、教育…），或点击右上角上传文本文件。支持 PDF/Word 暂未开放，可先复制粘贴。"
          />
          <PrimaryButton class="mt-3 w-full" :disabled="parsing" @click="doParse">
            {{ parsing ? '解析中…' : 'AI 解析简历' }}
          </PrimaryButton>
          <div
            v-if="msg"
            class="mt-3 rounded-lg border px-3 py-2 text-[12px]"
            :class="msg.startsWith('解析失败') || msg.startsWith('写入失败') ? 'border-red-300 text-red-600' : 'border-neutral-200 text-neutral-600'"
          >
            {{ msg }}
          </div>
        </section>

        <!-- 右：解析结果 -->
        <section class="card-glass p-5">
          <div class="mb-4 flex items-center justify-between">
            <span class="text-[13px] font-semibold text-neutral-900">解析结果</span>
            <PrimaryButton v-if="parsed" @click="openWrite">写入档案</PrimaryButton>
          </div>

          <div v-if="!parsed" class="px-2 py-10 text-center text-[12px] text-neutral-400">
            解析后在此预览，确认无误再写入档案
          </div>

          <div v-else class="space-y-4 text-[12.5px]">
            <div class="grid grid-cols-2 gap-3">
              <div><span class="text-neutral-400">姓名：</span><span class="text-neutral-900">{{ parsed.full_name || '—' }}</span></div>
              <div><span class="text-neutral-400">邮箱：</span><span class="text-neutral-900">{{ parsed.email || '—' }}</span></div>
              <div><span class="text-neutral-400">电话：</span><span class="text-neutral-900">{{ parsed.phone || '—' }}</span></div>
              <div><span class="text-neutral-400">头衔：</span><span class="text-neutral-900">{{ parsed.headline || '—' }}</span></div>
            </div>

            <div v-if="parsed.summary" class="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div class="mb-1 text-[11px] text-neutral-400">个人简介</div>
              <div class="leading-relaxed text-neutral-700">{{ parsed.summary }}</div>
            </div>

            <div v-if="parsed.skills?.length" class="flex flex-wrap gap-1.5">
              <span v-for="(s, i) in parsed.skills" :key="i" class="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600">
                {{ s.name }}{{ s.level ? ` · ${s.level}` : '' }}
              </span>
            </div>

            <div v-if="parsed.experiences?.length">
              <div class="mb-1.5 text-[11px] text-neutral-400">工作经历（{{ parsed.experiences.length }}）</div>
              <div v-for="(e, i) in parsed.experiences" :key="i" class="mb-1.5 truncate text-neutral-900">
                <span class="font-medium">{{ e.role }}</span>
                <span v-if="e.company" class="text-neutral-500"> · {{ e.company }}</span>
              </div>
            </div>

            <div v-if="parsed.projects?.length">
              <div class="mb-1.5 text-[11px] text-neutral-400">项目（{{ parsed.projects.length }}）</div>
              <div v-for="(p, i) in parsed.projects" :key="i" class="mb-1.5 truncate text-neutral-900">
                <span class="font-medium">{{ p.name }}</span>
              </div>
            </div>

            <div v-if="parsed.education?.length">
              <div class="mb-1.5 text-[11px] text-neutral-400">教育（{{ parsed.education.length }}）</div>
              <div v-for="(e, i) in parsed.education" :key="i" class="mb-1.5 truncate text-neutral-900">
                <span class="font-medium">{{ e.school }}</span>
                <span v-if="e.degree || e.major" class="text-neutral-500"> · {{ [e.degree, e.major].filter(Boolean).join(' / ') }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 覆盖/合并选择 -->
    <Modal v-if="showConfirm" title="档案已有内容" max-width="max-w-md" @close="showConfirm = false">
      <p class="mb-4 text-[13px] leading-relaxed text-neutral-600">
        当前档案已有内容。导入的简历会：<br />
        · <span class="text-neutral-900">合并</span>：保留现有经历/技能，追加新解析的<br />
        · <span class="text-neutral-600">覆盖</span>：清空现有经历/技能/项目/教育，用简历内容重建
      </p>
      <div class="flex items-center justify-end gap-3">
        <SecondaryButton @click="showConfirm = false">取消</SecondaryButton>
        <SecondaryButton @click="writeArchive('merge')">合并</SecondaryButton>
        <PrimaryButton @click="writeArchive('overwrite')">覆盖</PrimaryButton>
      </div>
    </Modal>
  </div>
</template>
