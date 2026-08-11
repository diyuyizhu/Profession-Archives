/**
 * 原子笔记池子 store（A1）：自定义归类集合（如 项目实习 / 学校经历 / 技术栈），
 * 原子条目通过 collection_id 归属到某个池子。localStorage 持久化。
 */
import type { Collection } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-collections-v1'

const POOL_COLORS = [
  'text-[#38bdf8]',
  'text-[#a78bfa]',
  'text-[#32f08c]',
  'text-[#fbbf24]',
  'text-[#f472b6]',
  'text-[#f97316]',
]

/** 首次使用：空池子（不预置示例，用户自建） */
function defaultPools(): Collection[] {
  return []
}

function load(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return defaultPools() // 首次使用：预置示例池
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list
      .filter(
        (c): c is Collection =>
          Boolean(c) && typeof c === 'object' && typeof c.name === 'string' && typeof c.id === 'string',
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: typeof c.color === 'string' ? c.color : undefined,
        created_at: typeof c.created_at === 'string' ? c.created_at : new Date().toISOString(),
      }))
  } catch {
    return defaultPools()
  }
}

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>(load())

  const total = computed(() => collections.value.length)
  const allTags = computed(() => new Set(collections.value.map((c) => c.name)))

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(collections.value))
    } catch (err) {
      console.error('[collections] 保存失败', err)
      throw err
    }
  }

  function addCollection(name: string): Collection {
    const c: Collection = {
      id: uid('cl'),
      name: name.trim(),
      color: POOL_COLORS[collections.value.length % POOL_COLORS.length],
      created_at: new Date().toISOString(),
    }
    collections.value.push(c)
    persist()
    return c
  }

  function renameCollection(id: string, name: string): void {
    const c = collections.value.find((x) => x.id === id)
    if (!c) return
    c.name = name.trim()
    persist()
  }

  /** 删除池子：同步清理条目上的归属（条目保留，回"未分类"） */
  function removeCollection(id: string): void {
    collections.value = collections.value.filter((c) => c.id !== id)
    persist()
  }

  function nameOf(id: string | undefined): string {
    if (!id) return '未分类'
    return collections.value.find((c) => c.id === id)?.name ?? '未分类'
  }

  function colorOf(id: string | undefined): string {
    return collections.value.find((c) => c.id === id)?.color ?? 'text-[rgba(245,249,254,0.4)]'
  }

  return { collections, total, allTags, addCollection, renameCollection, removeCollection, nameOf, colorOf }
})
