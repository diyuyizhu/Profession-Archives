/**
 * 投递「多维表格」配置 store：自定义属性表结构 + 保存的视图（筛选/排序/隐藏列）。
 * 属性**值**存在各投递上（Application.properties），由 application store 读写。
 * localStorage 持久化。
 */
import type { PropertyDef, PropertyOption, PropertyType } from '@pa/shared'
import { createView, emptyFilter, normalizeView, type BoardView, type FilterGroup, type SortRule } from '@pa/shared/property'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

/**
 * 作用域：投递（application）/ 岗位（job）。
 * 同一个「属性 + 视图」机制服务两个实体，只靠存储键区分，互不干扰。
 */
export type PropertyScope = 'application' | 'job'

interface ScopeKeys {
  properties: string
  views: string
  activeView: string
}

function keysOf(scope: PropertyScope): ScopeKeys {
  return {
    properties: `pa-${scope}-properties-v1`,
    views: `pa-${scope}-views-v1`,
    activeView: `pa-${scope}-active-view-v1`,
  }
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`[properties] 保存 ${key} 失败`, err)
    throw err
  }
}

const VALID_TYPES: PropertyType[] = ['text', 'long_text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url']

/** 属性定义结构校验 */
function normalizeProperties(raw: unknown): PropertyDef[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PropertyDef[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    if (typeof p.id !== 'string' || !p.id.startsWith('prop_') || seen.has(p.id)) continue
    const type = VALID_TYPES.includes(p.type as PropertyType) ? (p.type as PropertyType) : 'text'
    seen.add(p.id)
    const options = Array.isArray(p.options)
      ? (p.options as unknown[])
          .filter((o): o is PropertyOption => Boolean(o) && typeof o === 'object' && typeof (o as PropertyOption).name === 'string')
          .map((o) => ({ id: typeof o.id === 'string' ? o.id : uid('opt'), name: o.name }))
      : undefined
    out.push({
      id: p.id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : '未命名属性',
      type,
      options: type === 'select' || type === 'multi_select' ? (options ?? []) : undefined,
    })
  }
  return out
}

function loadViews(viewsKey: string): BoardView[] {
  const raw = load<unknown>(viewsKey)
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeView).filter((v): v is BoardView => v !== null)
}

/** 生成某个作用域的 store setup（投递 / 岗位各实例化一份） */
function createPropertiesSetup(scope: PropertyScope) {
  const KEYS = keysOf(scope)
  return () => {
  const properties = ref<PropertyDef[]>(normalizeProperties(load<unknown>(KEYS.properties)))
  const views = ref<BoardView[]>(loadViews(KEYS.views))
  const activeViewId = ref<string>(load<string>(KEYS.activeView) ?? '')

  /** 当前视图：'' 表示内置的「全部投递」视图（无筛选、默认排序） */
  const activeView = computed<BoardView | null>(
    () => views.value.find((v) => v.id === activeViewId.value) ?? null,
  )

  function persistProperties(): void {
    save(KEYS.properties, properties.value)
  }
  function persistViews(): void {
    save(KEYS.views, views.value)
  }

  /* ── 属性表结构 ── */

  function addProperty(name: string, type: PropertyType): PropertyDef {
    const def: PropertyDef = {
      id: uid('prop'),
      name: name.trim() || '未命名属性',
      type,
      options: type === 'select' || type === 'multi_select' ? [] : undefined,
    }
    properties.value = [...properties.value, def]
    persistProperties()
    return def
  }

  function updateProperty(id: string, patch: Partial<Pick<PropertyDef, 'name' | 'type'>>): void {
    properties.value = properties.value.map((p) => {
      if (p.id !== id) return p
      const type = patch.type ?? p.type
      const name = patch.name !== undefined ? patch.name.trim() || p.name : p.name
      return {
        ...p,
        name,
        type,
        // 切到选项型时补空数组，切走时清掉
        options: type === 'select' || type === 'multi_select' ? (p.options ?? []) : undefined,
      }
    })
    persistProperties()
  }

  /** 删除属性（值清理由调用方通过 application store 完成） */
  function removeProperty(id: string): void {
    properties.value = properties.value.filter((p) => p.id !== id)
    persistProperties()
    // 视图里引用的列/筛选/排序一并清理，避免悬空字段
    views.value = views.value.map((v) => ({
      ...v,
      hidden: v.hidden.filter((h) => h !== id),
      columns: v.columns?.filter((c) => c !== id),
      filter: { ...v.filter, conditions: v.filter.conditions.filter((c) => c.field !== id) },
      sorts: v.sorts.filter((s) => s.field !== id),
    }))
    persistViews()
  }

  function addOption(propertyId: string, name: string): void {
    properties.value = properties.value.map((p) =>
      p.id === propertyId
        ? { ...p, options: [...(p.options ?? []), { id: uid('opt'), name: name.trim() || '选项' }] }
        : p,
    )
    persistProperties()
  }

  function renameOption(propertyId: string, optionId: string, name: string): void {
    properties.value = properties.value.map((p) =>
      p.id === propertyId
        ? { ...p, options: (p.options ?? []).map((o) => (o.id === optionId ? { ...o, name: name.trim() || o.name } : o)) }
        : p,
    )
    persistProperties()
  }

  function removeOption(propertyId: string, optionId: string): void {
    properties.value = properties.value.map((p) =>
      p.id === propertyId ? { ...p, options: (p.options ?? []).filter((o) => o.id !== optionId) } : p,
    )
    persistProperties()
  }

  /* ── 视图 ── */

  function setActiveView(id: string): void {
    activeViewId.value = id
    save(KEYS.activeView, id)
  }

  function saveView(name: string, snapshot: Partial<Pick<BoardView, 'kind' | 'filter' | 'sorts' | 'hidden' | 'columns'>>): BoardView {
    const view = { ...createView(name), ...snapshot }
    views.value = [...views.value, view]
    setActiveView(view.id)
    persistViews()
    return view
  }

  function updateView(id: string, patch: Partial<Omit<BoardView, 'id'>>): void {
    views.value = views.value.map((v) => (v.id === id ? { ...v, ...patch } : v))
    persistViews()
  }

  function removeView(id: string): void {
    views.value = views.value.filter((v) => v.id !== id)
    persistViews()
    if (activeViewId.value === id) setActiveView('')
  }

  function duplicateView(id: string): void {
    const view = views.value.find((v) => v.id === id)
    if (!view) return
    saveView(`${view.name} 副本`, {
      kind: view.kind,
      filter: { op: view.filter.op, conditions: view.filter.conditions.map((c) => ({ ...c })) },
      sorts: view.sorts.map((s) => ({ ...s })),
      hidden: [...view.hidden],
      columns: view.columns ? [...view.columns] : undefined,
    })
  }

  /** 当前筛选（内置视图 = 空筛选） */
  const activeFilter = computed<FilterGroup>(() => activeView.value?.filter ?? emptyFilter())
  const activeSorts = computed<SortRule[]>(() => activeView.value?.sorts ?? [])

  return {
    properties,
    views,
    activeViewId,
    activeView,
    activeFilter,
    activeSorts,
    addProperty,
    updateProperty,
    removeProperty,
    addOption,
    renameOption,
    removeOption,
    setActiveView,
    saveView,
    updateView,
    removeView,
    duplicateView,
  }
  }
}

/** 投递的多维表格配置 */
export const usePropertiesStore = defineStore('properties', createPropertiesSetup('application'))

/** 岗位库的多维表格配置（同机制、不同存储键，与投递互不干扰） */
export const useJobPropertiesStore = defineStore('jobProperties', createPropertiesSetup('job'))
