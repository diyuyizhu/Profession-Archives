/**
 * 投递「多维表格」领域（B 模块增强）：自定义属性 + 筛选 + 排序。
 *
 * 设计要点：
 * - 内置字段（公司/岗位/渠道/日期…）保留原样，**不属性化**，保证漏斗、插件回传、
 *   批量导入、特化简历等既有链路不受影响；
 * - 用户可另加自定义属性，值存在 `Application.properties`（按属性 id 索引）；
 * - 表格列 = 内置字段 + 自定义属性（顺序由视图配置决定）；
 * - 筛选/排序是纯函数，前端 localStorage 版与未来 server 版共用。
 *
 * 字段引用约定：内置字段用其键名（如 `company`），自定义属性用属性 id（`prop_*`），
 * 二者前缀天然不冲突。
 */
import type { Application, ApplicationStatus, PropertyDef, PropertyType, PropertyValue, PropertyValues } from './index.js'

/** 字段取值形态：决定可用运算符与比较方式 */
export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'tags' | 'column'

/** 解析后的字段（内置字段或自定义属性） */
export interface ResolvedField {
  /** 字段引用：内置字段键名 / 属性 id */
  key: string
  name: string
  kind: FieldKind
  /** 是否为用户自定义属性（决定能否删除/改类型） */
  custom: boolean
  /** 自定义属性专有 */
  type?: PropertyType
  options?: PropertyDef['options']
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: '文本',
  long_text: '长文本',
  number: '数字',
  select: '单选',
  multi_select: '多选',
  date: '日期',
  checkbox: '勾选框',
  url: '链接',
}

export const PROPERTY_TYPE_ICONS: Record<PropertyType, string> = {
  text: 'A',
  long_text: '¶',
  number: '#',
  select: '◉',
  multi_select: '≣',
  date: '📅',
  checkbox: '☑',
  url: '🔗',
}

/** 值形态 → 编辑器类型 */
export function propertyKind(type: PropertyType): FieldKind {
  switch (type) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'checkbox':
      return 'boolean'
    case 'multi_select':
      return 'tags'
    case 'select':
      return 'column'
    default:
      return 'text'
  }
}

/** 内置字段（表格列 + 筛选字段；顺序即默认列顺序） */
export const BUILTIN_FIELDS: ResolvedField[] = [
  { key: 'title', name: '岗位名称', kind: 'text', custom: false },
  { key: 'company', name: '公司', kind: 'text', custom: false },
  { key: 'status', name: '看板列', kind: 'column', custom: false },
  { key: 'channel', name: '渠道', kind: 'text', custom: false },
  { key: 'apply_method', name: '投递方式', kind: 'text', custom: false },
  { key: 'applied_at', name: '投递日期', kind: 'date', custom: false },
  { key: 'updated_at', name: '更新时间', kind: 'date', custom: false },
  { key: 'importance', name: '重要性', kind: 'number', custom: false },
  { key: 'total_rounds', name: '预期轮数', kind: 'number', custom: false },
  { key: 'tags', name: '标签', kind: 'tags', custom: false },
  { key: 'groups', name: '分组', kind: 'tags', custom: false },
  { key: 'reject_reason', name: '拒绝原因', kind: 'text', custom: false },
  { key: 'url', name: '岗位链接', kind: 'text', custom: false },
  { key: 'notes', name: '备注', kind: 'text', custom: false },
]

/** 默认显示的列（其余内置字段可在「列」菜单里打开） */
export const DEFAULT_VISIBLE_FIELDS = ['title', 'company', 'status', 'channel', 'applied_at', 'importance', 'tags']

/**
 * 内置字段 + 自定义属性 → 可选字段列表。
 * \`builtins\` 可换成别的实体内置字段表（岗位见 shared/job.ts 的 JOB_BUILTIN_FIELDS）。
 */
export function resolveFields(
  properties: PropertyDef[],
  builtins: ResolvedField[] = BUILTIN_FIELDS,
): ResolvedField[] {
  return [
    ...builtins,
    ...properties.map((p) => ({
      key: p.id,
      name: p.name,
      kind: propertyKind(p.type),
      custom: true,
      type: p.type,
      options: p.options,
    })),
  ]
}

export function findField(
  properties: PropertyDef[],
  key: string,
  builtins: ResolvedField[] = BUILTIN_FIELDS,
): ResolvedField | undefined {
  return resolveFields(properties, builtins).find((f) => f.key === key)
}

/**
 * 可承载字段的记录：投递（Application）与岗位（JobPosting）都满足这个最小结构。
 * 字段求值 / 筛选 / 排序只依赖它，于是同一套「多维表格」能力可复用到多个实体。
 */
export interface FieldBearing {
  properties?: PropertyValues
}

/** 取字段值（自定义属性从 properties 里取，内置字段取记录自身字段） */
export function getFieldValue(record: FieldBearing, key: string): PropertyValue {
  if (key.startsWith('prop_')) return record.properties?.[key]
  const raw = (record as unknown as Record<string, unknown>)[key]
  if (raw === undefined || raw === null) return undefined
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string')
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw
  return undefined
}

/** 值的可读文本（表格展示 / 筛选比较共用） */
export function formatValue(value: PropertyValue, kind: FieldKind): string {
  if (value === undefined || value === null || value === '') return ''
  if (kind === 'tags') return Array.isArray(value) ? value.join('、') : String(value)
  if (kind === 'boolean') return value ? '是' : '否'
  if (kind === 'number') return typeof value === 'number' ? String(value) : String(value)
  return String(value)
}

/** 是否为空值（筛选 is_empty / is_not_empty） */
export function isEmptyValue(value: PropertyValue): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/* ── 筛选 ─────────────────────────────────────────────────── */

export type FilterOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'before'
  | 'after'
  | 'on'
  | 'is_true'
  | 'is_false'

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: '包含',
  not_contains: '不包含',
  equals: '等于',
  not_equals: '不等于',
  is_empty: '为空',
  is_not_empty: '不为空',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  before: '早于',
  after: '晚于',
  on: '等于日期',
  is_true: '已勾选',
  is_false: '未勾选',
}

/** 某字段形态可用的运算符 */
export function operatorsFor(kind: FieldKind): FilterOperator[] {
  switch (kind) {
    case 'number':
      return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
    case 'date':
      return ['on', 'before', 'after', 'is_empty', 'is_not_empty']
    case 'boolean':
      return ['is_true', 'is_false']
    case 'tags':
      return ['contains', 'not_contains', 'is_empty', 'is_not_empty']
    case 'column':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
    default:
      return ['contains', 'not_contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty']
  }
}

/** 不需要输入值的运算符 */
export function isValuelessOperator(op: FilterOperator): boolean {
  return op === 'is_empty' || op === 'is_not_empty' || op === 'is_true' || op === 'is_false'
}

export interface FilterCondition {
  id: string
  /** 字段引用：内置字段键名 / 属性 id */
  field: string
  operator: FilterOperator
  /** 文本/数字/日期/选项名；为空即「空值」类判断 */
  value?: string
}

export interface FilterGroup {
  op: 'and' | 'or'
  conditions: FilterCondition[]
}

export function emptyFilter(): FilterGroup {
  return { op: 'and', conditions: [] }
}

/** 单条条件匹配 */
export function matchCondition(record: FieldBearing, cond: FilterCondition): boolean {
  const raw = getFieldValue(record, cond.field)
  const text = raw === undefined || raw === null ? '' : Array.isArray(raw) ? raw.join(' ') : String(raw)
  const needle = (cond.value ?? '').trim()
  const lower = text.toLowerCase()
  const needleLower = needle.toLowerCase()

  switch (cond.operator) {
    case 'is_empty':
      return isEmptyValue(raw)
    case 'is_not_empty':
      return !isEmptyValue(raw)
    case 'is_true':
      return raw === true
    case 'is_false':
      return raw !== true
    case 'contains':
      // 多选 / 标签：按元素精确匹配；文本：子串匹配
      if (Array.isArray(raw)) return raw.some((v) => v.toLowerCase() === needleLower)
      return lower.includes(needleLower)
    case 'not_contains':
      if (Array.isArray(raw)) return !raw.some((v) => v.toLowerCase() === needleLower)
      return !lower.includes(needleLower)
    case 'equals':
      if (Array.isArray(raw)) return raw.some((v) => v.toLowerCase() === needleLower)
      return lower === needleLower
    case 'not_equals':
      if (Array.isArray(raw)) return !raw.some((v) => v.toLowerCase() === needleLower)
      return lower !== needleLower
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = Number(text)
      const b = Number(needle)
      if (Number.isNaN(a) || Number.isNaN(b)) return false
      if (cond.operator === 'gt') return a > b
      if (cond.operator === 'gte') return a >= b
      if (cond.operator === 'lt') return a < b
      return a <= b
    }
    case 'before':
      return Boolean(text) && Boolean(needle) && text < needle
    case 'after':
      return Boolean(text) && Boolean(needle) && text > needle
    case 'on':
      // 日期字段可能是 'YYYY-MM-DD'，按前缀比较，容忍带时间
      return Boolean(text) && text.slice(0, needle.length) === needle
    default:
      return true
  }
}

/** 整组筛选（空条件视为通过） */
export function matchesFilter(record: FieldBearing, group: FilterGroup | undefined): boolean {
  if (!group || !group.conditions.length) return true
  const results = group.conditions.map((c) => matchCondition(record, c))
  return group.op === 'and' ? results.every(Boolean) : results.some(Boolean)
}

/** 只保留真正生效的条件（字段为空 / 值缺失的草稿行忽略） */
export function activeConditions(group: FilterGroup | undefined): FilterCondition[] {
  if (!group) return []
  return group.conditions.filter((c) => c.field)
}

/* ── 排序 ─────────────────────────────────────────────────── */

export interface SortRule {
  /** 字段引用 */
  field: string
  desc: boolean
}

/** 按字段比较两条记录（空值恒排最后） */
export function compareField(
  a: FieldBearing,
  b: FieldBearing,
  rule: SortRule,
): number {
  const va = getFieldValue(a, rule.field)
  const vb = getFieldValue(b, rule.field)
  const ea = isEmptyValue(va)
  const eb = isEmptyValue(vb)
  if (ea && eb) return 0
  if (ea) return 1
  if (eb) return -1

  let diff: number
  if (typeof va === 'number' && typeof vb === 'number') {
    diff = va - vb
  } else if (Array.isArray(va) && Array.isArray(vb)) {
    diff = va.join('、').localeCompare(vb.join('、'), 'zh-CN')
  } else if (Array.isArray(va)) {
    diff = va.join('、').localeCompare(String(vb), 'zh-CN')
  } else if (Array.isArray(vb)) {
    diff = String(va).localeCompare(vb.join('、'), 'zh-CN')
  } else {
    diff = String(va).localeCompare(String(vb), 'zh-CN', { numeric: true })
  }
  return rule.desc ? -diff : diff
}

/** 多级排序（按 rules 顺序稳定排序；对投递与岗位通用） */
export function sortApplications<T extends FieldBearing>(
  apps: T[],
  rules: SortRule[],
  fallback?: (a: T, b: T) => number,
): T[] {
  const active = rules.filter((r) => r.field)
  const list = [...apps]
  list.sort((a, b) => {
    for (const rule of active) {
      const d = compareField(a, b, rule)
      if (d !== 0) return d
    }
    return fallback ? fallback(a, b) : 0
  })
  return list
}

/* ── 视图 ─────────────────────────────────────────────────── */

/**
 * 保存的视图：记住 表格 / 看板 类型、筛选、排序、隐藏列。
 * 与看板「列配置」互补：列配置管有哪些看板列，视图管怎么看这批投递。
 */
export interface BoardView {
  id: string
  name: string
  kind: 'table' | 'board'
  filter: FilterGroup
  sorts: SortRule[]
  /** 隐藏的列（内置字段键名 / 属性 id） */
  hidden: string[]
  /** 表格列顺序（含自定义属性） */
  columns?: string[]
}

export function createView(name: string, kind: 'table' | 'board' = 'table'): BoardView {
  return {
    id: `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    kind,
    filter: emptyFilter(),
    sorts: [],
    hidden: [],
  }
}

/** 视图结构校验（坏数据丢弃） */
export function normalizeView(raw: unknown): BoardView | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return null
  const kind = v.kind === 'board' ? 'board' : 'table'
  const conditions = Array.isArray((v.filter as FilterGroup | undefined)?.conditions)
    ? ((v.filter as FilterGroup).conditions as unknown[])
        .filter((c): c is FilterCondition => Boolean(c) && typeof c === 'object' && typeof (c as FilterCondition).field === 'string')
        .map((c) => ({ id: String(c.id ?? Math.random().toString(36).slice(2)), field: c.field, operator: c.operator ?? 'contains', value: c.value }))
    : []
  const op = (v.filter as FilterGroup | undefined)?.op === 'or' ? 'or' : 'and'
  const sorts = Array.isArray(v.sorts)
    ? (v.sorts as unknown[])
        .filter((s): s is SortRule => Boolean(s) && typeof s === 'object' && typeof (s as SortRule).field === 'string')
        .map((s) => ({ field: s.field, desc: Boolean(s.desc) }))
    : []
  const hidden = Array.isArray(v.hidden) ? v.hidden.filter((h): h is string => typeof h === 'string') : []
  const columns = Array.isArray(v.columns) ? v.columns.filter((c): c is string => typeof c === 'string') : undefined
  return { id: v.id, name: v.name, kind, filter: { op, conditions }, sorts, hidden, columns }
}

/** 看板列 id → 展示名（筛选用） */
export function columnFilterLabel(columnId: ApplicationStatus, name: string): string {
  return name || columnId
}
