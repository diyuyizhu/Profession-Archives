/**
 * 前端通用工具：ID 生成 + 空档案。
 * 首次启动不预置示例数据，用户从零开始。
 */
import type { Profile } from '@pa/shared'

export function nowIso(): string {
  return new Date().toISOString()
}

/** 生成 id（demo 场景够用；server 版用 crypto.randomUUID） */
export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/** 空档案（首次启动不预置示例数据；用户从零开始） */
export function buildEmptyProfile(): Profile {
  const ts = nowIso()
  return {
    id: uid('pf'),
    full_name: '',
    headline: '',
    email: '',
    phone: '',
    summary: '',
    skills: [],
    experiences: [],
    education: [],
    projects: [],
    journal: [],
    card_theme: 'classic',
    created_at: ts,
    updated_at: ts,
  }
}

