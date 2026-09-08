<script setup lang="ts">
/**
 * 知识库（模块 K）：Markdown 文档列表 / 编辑 / 分组 / 标签 / 全文搜索。
 * 与 journal（碎片日记）区分：知识库沉淀可复用的长期知识，支持结构化文档化。
 */
import { searchKnowledge, groupByDoc, allKnowledgeTags, filterByTags, knowledgeSummary } from '@pa/shared/knowledge'
import type { KnowledgeDoc } from '@pa/shared/knowledge'
import { computed, ref, watch } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useKnowledgeStore } from '@/stores/knowledge'

const store = useKnowledgeStore()

/* ── 筛选 ── */
const query = ref('')
const selectedTags = ref<Set<string>>(new Set())
const selectedGroup = ref<string | null>(null)

function toggleTag(t: string): void {
  if (selectedTags.value.has(t)) selectedTags.value.delete(t)
  else selectedTags.value.add(t)
}

const allTags = computed(() => allKnowledgeTags(store.docs))
const allGroups = computed(() => {
  const g = new Set<string>()
  for (const d of store.docs) if (d.group) g.add(d.group)
  return [...g].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const filteredDocs = computed(() => {
  let list = store.docs
  if (query.value.trim()) list = searchKnowledge(list, query.value)
  if (selectedTags.value.size) list = filterByTags(list, selectedTags.value)
  if (selectedGroup.value) list = list.filter((d) => d.group === selectedGroup.value)
  return list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
})

const groups = computed(() => groupByDoc(filteredDocs.value))

/* ── 编辑器 ── */
const editing = ref<KnowledgeDoc | null>(null)
const editTitle = ref('')
const editContent = ref('')
const editTagsText = ref('')
const editGroup = ref('')
const isCreating = ref(false)

function openCreate(): void {
  isCreating.value = true
  editing.value = null
  editTitle.value = ''
  editContent.value = ''
  editTagsText.value = ''
  editGroup.value = ''
}

function openEdit(doc: KnowledgeDoc): void {
  isCreating.value = false
  editing.value = doc
  editTitle.value = doc.title
  editContent.value = doc.content_md
  editTagsText.value = doc.tags.join(', ')
  editGroup.value = doc.group ?? ''
}

function save(): void {
  if (!editTitle.value.trim()) return
  const tags = editTagsText.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
  if (isCreating.value) {
    store.create({ title: editTitle.value.trim(), content_md: editContent.value, tags, group: editGroup.value.trim() || undefined })
  } else if (editing.value) {
    store.update(editing.value.id, { title: editTitle.value.trim(), content_md: editContent.value, tags, group: editGroup.value.trim() || undefined })
  }
  editing.value = store.docs.find((d) => d.id === editing.value?.id) ?? null
  isCreating.value = false
}

function doDelete(id: string): void {
  if (!confirm('确定删除此文档？')) return
  store.remove(id)
  if (editing.value?.id === id) { editing.value = null; isCreating.value = false }
}

function closeEditor(): void {
  editing.value = null
  isCreating.value = false
}

/* ── 预览模式 ── */
const previewMode = ref(true)

/** 简易 Markdown → HTML（标题/粗体/斜体/代码/列表/链接） */
function renderMd(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
  return `<p>${html}</p>`
}

watch(editing, () => { previewMode.value = true })
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-16">
      <PageHeader code="K" title="知识库" desc="Markdown 文档 · 标签 · 分组 · 全文搜索 · 可复用长期知识沉淀">
        <PrimaryButton @click="openCreate">＋ 新建文档</PrimaryButton>
      </PageHeader>

      <!-- 搜索 + 标签/分组筛选 -->
      <div class="card-glass mb-5 space-y-3 p-4">
        <input
          v-model="query"
          class="input-trae h-9 text-[12.5px]"
          placeholder="🔍 搜索标题、正文、标签…（多词用空格，AND 匹配）"
        />
        <div v-if="allTags.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-neutral-400">标签：</span>
          <button
            v-for="t in allTags"
            :key="t"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="selectedTags.has(t) ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:text-neutral-900'"
            @click="toggleTag(t)"
          >
            #{{ t }}
          </button>
        </div>
        <div v-if="allGroups.length" class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-neutral-400">分组：</span>
          <button
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="!selectedGroup ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 bg-neutral-50 text-neutral-500'"
            @click="selectedGroup = null"
          >
            全部
          </button>
          <button
            v-for="g in allGroups"
            :key="g"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="selectedGroup === g ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:text-neutral-900'"
            @click="selectedGroup = g"
          >
            ◆ {{ g }}
          </button>
        </div>
        <div class="text-[11px] text-neutral-400">{{ filteredDocs.length }} / {{ store.total }} 篇文档</div>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        <!-- 左：文档列表（按分组折叠） -->
        <aside class="space-y-4">
          <div v-for="g in groups" :key="g.group">
            <div class="mb-2 text-[12px] font-semibold tracking-wide text-neutral-900">{{ g.group }}</div>
            <div class="space-y-1.5">
              <button
                v-for="doc in g.docs"
                :key="doc.id"
                class="w-full rounded-lg border p-3 text-left transition-colors"
                :class="editing?.id === doc.id && !isCreating ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:border-neutral-300'"
                @click="openEdit(doc)"
              >
                <div class="text-[13px] font-medium text-neutral-900 truncate">{{ doc.title }}</div>
                <div class="mt-0.5 text-[11px] text-neutral-400 truncate">{{ knowledgeSummary(doc.content_md, 50) }}</div>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span v-for="t in doc.tags.slice(0, 3)" :key="t" class="rounded bg-neutral-100 px-1 py-px text-[9.5px] text-neutral-500">#{{ t }}</span>
                </div>
              </button>
            </div>
          </div>
          <div v-if="!groups.length" class="py-8 text-center text-[12px] text-neutral-400">
            {{ store.total ? '无匹配结果' : '还没有文档，点上方「＋ 新建文档」开始' }}
          </div>
        </aside>

        <!-- 右：编辑器 / 空态 -->
        <div v-if="editing || isCreating" class="card-glass p-5">
          <div class="mb-4 flex items-center justify-between">
            <input
              v-model="editTitle"
              class="heading-tight w-full border-none bg-transparent text-[18px] outline-none placeholder-neutral-300"
              placeholder="文档标题…"
            />
            <button class="ml-3 shrink-0 text-[12px] text-neutral-400 hover:text-neutral-900" @click="closeEditor">✕ 关闭</button>
          </div>

          <!-- 标签 + 分组 -->
          <div class="mb-4 flex flex-wrap items-center gap-3 text-[12px]">
            <label class="flex items-center gap-1.5">
              <span class="text-neutral-400">标签：</span>
              <input v-model="editTagsText" class="input-trae h-8 w-48 text-[12px]" placeholder="逗号分隔" />
            </label>
            <label class="flex items-center gap-1.5">
              <span class="text-neutral-400">分组：</span>
              <input v-model="editGroup" class="input-trae h-8 w-36 text-[12px]" placeholder="如 面经整理" />
            </label>
          </div>

          <!-- Markdown 编辑器 -->
          <div class="mb-3 flex items-center gap-2">
            <button
              class="rounded border px-2.5 py-1 text-[11px]"
              :class="previewMode ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'"
              @click="previewMode = true"
            >
              预览
            </button>
            <button
              class="rounded border px-2.5 py-1 text-[11px]"
              :class="!previewMode ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'"
              @click="previewMode = false"
            >
              编辑
            </button>
          </div>

          <div v-if="previewMode" class="prose prose-sm min-h-[300px] max-w-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-700" v-html="renderMd(editContent)" />
          <textarea
            v-else
            v-model="editContent"
            class="input-trae min-h-[300px] resize-y py-3 font-mono text-[13px]"
            placeholder="Markdown 正文…"
          />

          <!-- 操作 -->
          <div class="mt-4 flex items-center justify-between">
            <button
              v-if="!isCreating && editing"
              class="text-[12px] text-red-400 hover:text-red-600"
              @click="doDelete(editing.id)"
            >
              删除
            </button>
            <span v-else />
            <div class="flex items-center gap-2">
              <SecondaryButton class="!h-8 !px-3 !text-[12px]" @click="closeEditor">取消</SecondaryButton>
              <PrimaryButton class="!h-8 !px-4 !text-[12px]" :disabled="!editTitle.trim()" @click="save">
                {{ isCreating ? '创建' : '保存' }}
              </PrimaryButton>
            </div>
          </div>
        </div>

        <!-- 右：空态提示 -->
        <div v-else class="card-glass flex flex-col items-center justify-center gap-3 px-5 py-20 text-center">
          <span class="text-3xl">📝</span>
          <div class="text-[14px] text-neutral-600">选择左侧文档查看，或创建新文档</div>
          <div class="max-w-sm text-[12px] leading-relaxed text-neutral-400">
            知识库用于沉淀可复用的长期知识：面试复盘整理、学习笔记、技术方案、项目文档。
            支持 Markdown 编辑、标签分类、分组管理、全文搜索。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
