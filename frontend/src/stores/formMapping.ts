/**
 * 站点字段映射 store（模块 D4）：per-origin 字段映射记忆，localStorage 持久化。
 * 浏览器插件（wxt）落地后，通过本地桥把映射上报/查询，这里是与之一致的前端管理界面。
 */
import type { FormMapping, FormMappingPayload } from '@pa/shared'
import { AUTOMATION_CONTROL_TYPES, AUTOMATION_TARGET_FIELDS } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'

const KEY = 'pa-form-mappings-v1'

function load(): unknown {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

/** 结构校验：坏数据丢弃（target_field 枚举校验 + id 补齐），避免渲染空标签/重复 key */
function sanitize(list: unknown): FormMapping[] {
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (m): m is Record<string, unknown> =>
        Boolean(m) && typeof m === 'object' && typeof m.origin === 'string',
    )
    .filter((m) => {
      const t = m.target_field
      const c = m.control_type
      return (
        typeof t === 'string' &&
        AUTOMATION_TARGET_FIELDS.includes(t as (typeof AUTOMATION_TARGET_FIELDS)[number]) &&
        (c === undefined || AUTOMATION_CONTROL_TYPES.includes(c as (typeof AUTOMATION_CONTROL_TYPES)[number]))
      )
    })
    .map((m) => ({
      id: typeof m.id === 'string' && m.id ? m.id : uid('fm'),
      origin: m.origin as string,
      field_key: typeof m.field_key === 'string' ? m.field_key : '',
      field_label: typeof m.field_label === 'string' ? m.field_label : undefined,
      control_type: typeof m.control_type === 'string' ? (m.control_type as FormMapping['control_type']) : undefined,
      target_field: m.target_field as FormMapping['target_field'],
      updated_at: typeof m.updated_at === 'string' ? m.updated_at : new Date().toISOString(),
    }))
    .filter((m) => m.field_key.trim())
}

export const useFormMappingStore = defineStore('formMapping', () => {
  const mappings = ref<FormMapping[]>(sanitize(load()))

  const origins = computed(() => {
    const set = new Set(mappings.value.map((m) => m.origin))
    return [...set].sort()
  })

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(mappings.value))
    } catch (err) {
      console.error('[formMapping] 保存失败', err)
      throw err
    }
  }

  function addMapping(payload: FormMappingPayload): FormMapping {
    const mapping: FormMapping = {
      id: uid('fm'),
      ...payload,
      origin: payload.origin.trim(),
      field_key: payload.field_key.trim(),
      updated_at: new Date().toISOString(),
    }
    mappings.value.push(mapping)
    persist()
    return mapping
  }

  function removeMapping(id: string): void {
    mappings.value = mappings.value.filter((m) => m.id !== id)
    persist()
  }

  function clearOrigin(origin: string): void {
    mappings.value = mappings.value.filter((m) => m.origin !== origin)
    persist()
  }

  return { mappings, origins, addMapping, removeMapping, clearOrigin }
})
