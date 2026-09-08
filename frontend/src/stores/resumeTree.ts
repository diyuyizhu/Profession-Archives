/**
 * 简历树 store（模块 D/E）：以树结构沉淀所有简历版本。
 * - base：基础简历（上传简历解析后，由档案原子复刻一份）
 * - specialized：针对某岗位的 AI 特化简历（自动挂到树上，绑定投递）
 * 看板投递通过 application_id 关联到树上某份简历。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-resume-tree-v1'

export type ResumeNodeKind = 'base' | 'specialized'

export interface ResumeNode {
  id: string
  /** 简历名称（如「基础简历」「特化-XX公司-XX岗位」） */
  title: string
  /** 父节点 id；null = 根 */
  parent_id: string | null
  kind: ResumeNodeKind
  /** 特化简历关联的投递 id */
  application_id?: string
  /** 简历正文（Markdown） */
  content_md: string
  /** 组成这份简历的档案原子 id 列表 */
  atom_ids: string[]
  /** 特化时的 JD 摘要（追溯用） */
  jd?: string
  created_at: string
}

export interface ResumeNodeDraft {
  title: string
  parent_id: string | null
  kind: ResumeNodeKind
  application_id?: string
  content_md: string
  atom_ids?: string[]
  jd?: string
}

function load(): ResumeNode[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (n): n is ResumeNode =>
        Boolean(n) &&
        typeof n === 'object' &&
        typeof (n as ResumeNode).id === 'string' &&
        typeof (n as ResumeNode).title === 'string' &&
        typeof (n as ResumeNode).content_md === 'string',
    )
  } catch {
    return []
  }
}

export const useResumeTreeStore = defineStore('resumeTree', () => {
  const nodes = ref<ResumeNode[]>(load())

  const roots = computed(() => nodes.value.filter((n) => n.parent_id === null))

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(nodes.value))
    } catch (err) {
      console.error('[resumeTree] 保存失败', err)
      throw err
    }
  }

  function childrenOf(parentId: string | null): ResumeNode[] {
    return nodes.value.filter((n) => n.parent_id === parentId)
  }

  function addNode(draft: ResumeNodeDraft): ResumeNode {
    const node: ResumeNode = {
      id: uid('rs'),
      ...draft,
      atom_ids: draft.atom_ids ?? [],
      created_at: new Date().toISOString(),
    }
    nodes.value.push(node)
    persist()
    return node
  }

  function removeNode(id: string): void {
    // 连带删除子节点
    const idsToRemove = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const n of nodes.value) {
        if (n.parent_id && idsToRemove.has(n.parent_id) && !idsToRemove.has(n.id)) {
          idsToRemove.add(n.id)
          changed = true
        }
      }
    }
    nodes.value = nodes.value.filter((n) => !idsToRemove.has(n.id))
    persist()
  }

  /** 更新节点内容（base 简历内容 + 原子引用） */
  function updateNode(id: string, patch: Partial<Pick<ResumeNode, 'content_md' | 'atom_ids' | 'title' | 'jd'>>): void {
    const node = nodes.value.find((n) => n.id === id)
    if (!node) return
    Object.assign(node, patch)
    persist()
  }

  /** 绑定投递：把某份简历关联到某个投递 */
  function bindApplication(nodeId: string, applicationId: string): void {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (!node) return
    node.application_id = applicationId
    persist()
  }

  /** 按投递 id 查关联简历 */
  function getByApplication(applicationId: string): ResumeNode | undefined {
    return nodes.value.find((n) => n.application_id === applicationId)
  }

  /** 基础简历（第一个 kind=base 的根节点） */
  const baseResume = computed(() => nodes.value.find((n) => n.kind === 'base'))

  return {
    nodes,
    roots,
    baseResume,
    childrenOf,
    addNode,
    removeNode,
    bindApplication,
    getByApplication,
  }
})
