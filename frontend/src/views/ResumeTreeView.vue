<script setup lang="ts">
/**
 * 简历树（一级功能 · 主入口）：沉淀所有简历版本。
 * - 根 = 基础简历（上传简历解析后由档案原子复刻）
 * - 分支 = 针对各岗位的 AI 特化简历
 * - 关联看板投递，可在此查看 / 删除 / 跳转
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ModuleTabs, { type ModuleTab } from '@/components/ModuleTabs.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useResumeTreeStore, type ResumeNode } from '@/stores/resumeTree'

const tree = useResumeTreeStore()
const appStore = useApplicationStore()
const router = useRouter()

/** 简历一级功能 tab */
const tabs: ModuleTab[] = [
  { id: 'tree', label: '简历树', path: '/resume' },
  { id: 'import', label: '简历导入', path: '/resume/import' },
  { id: 'generate', label: '简历生成', path: '/tracking/resume' },
  { id: 'polish', label: '简历润色', path: '/ai/polish' },
  { id: 'match', label: 'JD 匹配', path: '/ai/match' },
]

const selectedId = ref<string | null>(null)
const selected = computed(() => tree.nodes.find((n) => n.id === selectedId.value) ?? null)

/** 树形展示：根 + 其子节点（扁平化，缩进表示层级） */
interface TreeNodeRow {
  node: ResumeNode
  depth: number
}
const rows = computed<TreeNodeRow[]>(() => {
  const out: TreeNodeRow[] = []
  for (const root of tree.roots) {
    out.push({ node: root, depth: 0 })
    for (const child of tree.childrenOf(root.id)) {
      out.push({ node: child, depth: 1 })
    }
  }
  return out
})

function select(node: ResumeNode): void {
  selectedId.value = node.id
}

function appTitleOf(node: ResumeNode): string | null {
  if (!node.application_id) return null
  const app = appStore.applications.find((a) => a.id === node.application_id)
  return app ? `${app.company} · ${app.title}` : null
}

function openApp(node: ResumeNode): void {
  if (node.application_id) router.push(`/tracking/detail/${node.application_id}`)
}

function remove(node: ResumeNode): void {
  if (!window.confirm(`删除简历「${node.title}」及其子节点？`)) return
  tree.removeNode(node.id)
  if (selectedId.value === node.id) selectedId.value = null
}

const KIND_LABEL: Record<ResumeNode['kind'], string> = {
  base: '基础简历',
  specialized: '特化简历',
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-6xl px-6 pb-16">
      <PageHeader code="E" title="简历" desc="简历树 · 导入 · 生成 · 润色 · 匹配">
        <PrimaryButton @click="router.push('/resume/import')">＋ 导入简历</PrimaryButton>
      </PageHeader>

      <ModuleTabs :tabs="tabs" />

      <div v-if="!tree.nodes.length" class="card-glass flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
        <span class="text-4xl">🌳</span>
        <div class="text-[14px] text-neutral-600">简历树还是空的</div>
        <div class="text-[12px] text-neutral-400">
          先「导入简历」生成基础简历，或在看板投递上「AI 特化」自动挂到树上
        </div>
        <PrimaryButton class="mt-2" @click="router.push('/resume/import')">去导入简历</PrimaryButton>
      </div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <!-- 左：树形列表 -->
        <section class="card-glass h-fit p-3">
          <div class="space-y-1">
            <button
              v-for="row in rows"
              :key="row.node.id"
              class="flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-colors"
              :class="selectedId === row.node.id ? 'border-neutral-900 bg-neutral-100' : 'border-transparent hover:bg-neutral-50'"
              :style="`padding-left: ${8 + row.depth * 20}px`"
              @click="select(row.node)"
            >
              <span class="shrink-0 text-[13px]">{{ row.depth ? '└' : '🌱' }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12.5px] font-medium text-neutral-900">{{ row.node.title }}</span>
                <span class="mt-0.5 block truncate text-[10.5px] text-neutral-400">
                  {{ KIND_LABEL[row.node.kind] }}
                  <template v-if="appTitleOf(row.node)"> · {{ appTitleOf(row.node) }}</template>
                </span>
              </span>
              <button
                class="shrink-0 px-1 text-[11px] text-neutral-400 hover:text-red-600"
                title="删除"
                @click.stop="remove(row.node)"
              >
                ✕
              </button>
            </button>
          </div>
        </section>

        <!-- 右：内容预览 -->
        <section class="card-glass min-w-0 p-5">
          <div v-if="!selected" class="px-2 py-12 text-center text-[12px] text-neutral-400">
            左侧选择一份简历查看内容
          </div>
          <div v-else>
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[14px] font-semibold text-neutral-900">{{ selected.title }}</div>
                <div class="mt-0.5 text-[11px] text-neutral-400">
                  {{ KIND_LABEL[selected.kind] }} · {{ selected.created_at.slice(0, 10) }}
                  <span v-if="selected.atom_ids.length"> · {{ selected.atom_ids.length }} 个原子</span>
                </div>
              </div>
              <button
                v-if="selected.application_id"
                class="rounded-full border border-neutral-400 px-3 py-1 text-[11.5px] text-neutral-900 hover:bg-neutral-100"
                @click="openApp(selected)"
              >
                查看关联投递 →
              </button>
            </div>
            <div class="overflow-x-auto">
              <pre class="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-neutral-800">{{ selected.content_md }}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
