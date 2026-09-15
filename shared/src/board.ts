/**
 * 看板列模型（B1）—— 列由用户自定义，投递的 `status` 即「所在列 id」。
 *
 * 列取代了原先写死的状态机，原语义改由两个维度表达：
 *   - **列顺序** → 流程推进（下一列 = 下一步；最后一列进行中 → 成功列）
 *   - **列角色 role** → normal 进行中 / success 成功 / failure 失败 / archived 归档（后三者=终态列）
 *
 * ⚠️ 运行时注册表：shared 里大量函数（statusMeta / isTerminal / stageIndex / boardStages …）
 * 需要按「当前列」解释一个 status 字符串，若把 columns 透传到全部调用点会污染 20+ 个视图。
 * 因此这里维护一份注册表，由 application store 在列加载/变更时写入
 * （`setActiveBoardColumns`）。未初始化时回退到内置默认列，保证纯函数在测试里也可用。
 */
import {
  APPLICATION_STATUS_META,
  type ApplicationStatusMeta,
  type BoardColumn,
  type BoardRole,
} from './index.js'

/** 角色显示名（列头/徽章描述用） */
export const ROLE_LABELS: Record<BoardRole, string> = {
  normal: '进行中',
  success: '成功',
  failure: '失败',
  archived: '归档',
}

/**
 * 角色配色（经典黑白灰阶）：
 * 成功 = 反色实心；失败 = 淡化；归档 = 虚线。
 */
const ROLE_STYLES: Record<BoardRole, Pick<ApplicationStatusMeta, 'text' | 'chip' | 'dot'>> = {
  normal: {
    text: 'text-neutral-900',
    chip: 'border-neutral-400 bg-neutral-100',
    dot: 'bg-neutral-700',
  },
  success: {
    text: 'text-white',
    chip: 'border-neutral-900 bg-neutral-900',
    dot: 'bg-neutral-900',
  },
  failure: {
    text: 'text-neutral-400',
    chip: 'border-neutral-200 bg-neutral-50',
    dot: 'bg-neutral-200',
  },
  archived: {
    text: 'text-neutral-400',
    chip: 'border-dashed border-neutral-300 bg-neutral-50',
    dot: 'bg-neutral-300',
  },
}

/** 内置默认列（首启 / 老数据沿用历史 id，保证零迁移成本） */
export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: 'backlog', name: '备选', role: 'normal' },
  { id: 'applied', name: '已投', role: 'normal' },
  { id: 'viewed', name: '简历被读', role: 'normal' },
  { id: 'round_1', name: '第 1 面', role: 'normal' },
  { id: 'round_2', name: '第 2 面', role: 'normal' },
  { id: 'round_3', name: '第 3 面', role: 'normal' },
  { id: 'offer', name: 'Offer', role: 'success' },
  { id: 'rejected', name: '拒绝', role: 'failure' },
  { id: 'withdrawn', name: '放弃', role: 'archived' },
]

/** 「加看板」可选的内置阶段预设（含默认未展示的第 4~8 面与常用自定义名） */
export const COLUMN_PRESETS: BoardColumn[] = [
  { id: 'backlog', name: '备选', role: 'normal' },
  { id: 'applied', name: '已投', role: 'normal' },
  { id: 'viewed', name: '简历被读', role: 'normal' },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `round_${i + 1}`,
    name: `第 ${i + 1} 面`,
    role: 'normal' as BoardRole,
  })),
  { id: 'offer', name: 'Offer', role: 'success' },
  { id: 'rejected', name: '拒绝', role: 'failure' },
  { id: 'withdrawn', name: '放弃', role: 'archived' },
]

/** 历史 id → 默认列名（数据里出现但配置里没有的 status，自动补列时用） */
export function legacyColumnName(id: string): string {
  const preset = COLUMN_PRESETS.find((c) => c.id === id)
  if (preset) return preset.name
  const round = /^round_(\d+)$/.exec(id)
  if (round) return `第 ${round[1]} 面`
  const legacy = APPLICATION_STATUS_META[id as keyof typeof APPLICATION_STATUS_META]
  return legacy?.label ?? id
}

/** 历史 id → 默认角色 */
export function legacyColumnRole(id: string): BoardRole {
  if (id === 'offer') return 'success'
  if (id === 'rejected') return 'failure'
  if (id === 'withdrawn') return 'archived'
  return 'normal'
}

/** 生成稳定列 id（自定义列） */
export function createColumnId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `col_${Date.now().toString(36)}_${rand}`
}

/** 新建自定义列 */
export function createColumn(name: string, role: BoardRole = 'normal'): BoardColumn {
  return { id: createColumnId(), name: name.trim() || '新看板', role }
}

/** 列 id 是否合法（宽松：非空、无控制字符、长度受限） */
export function isValidColumnId(id: unknown): id is string {
  if (typeof id !== 'string') return false
  const trimmed = id.trim()
  // eslint-disable-next-line no-control-regex
  return trimmed.length > 0 && trimmed.length <= 64 && !/[\u0000-\u001f]/.test(trimmed)
}

/** 结构校验 + 去重（坏数据丢弃而不是白屏） */
export function normalizeBoardColumns(raw: unknown): BoardColumn[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: BoardColumn[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    if (!isValidColumnId(c.id) || seen.has(c.id.trim())) continue
    const id = c.id.trim()
    seen.add(id)
    const role: BoardRole =
      c.role === 'success' || c.role === 'failure' || c.role === 'archived' ? c.role : 'normal'
    out.push({
      id,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : legacyColumnName(id),
      role,
    })
  }
  return out
}

/* ── 运行时注册表 ─────────────────────────────────────────── */

let activeColumns: BoardColumn[] = DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c }))

/** 由 store 在列加载 / 变更后写入 */
export function setActiveBoardColumns(columns: BoardColumn[]): void {
  activeColumns = columns.length ? columns.map((c) => ({ ...c })) : DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c }))
}

/** 当前列（只读副本） */
export function getActiveBoardColumns(): BoardColumn[] {
  return activeColumns
}

/** 查一列 */
export function activeColumn(id: string): BoardColumn | undefined {
  return activeColumns.find((c) => c.id === id)
}

/** 是否终态列（success / failure / archived） */
export function isTerminalColumn(id: string): boolean {
  const col = activeColumn(id)
  return col ? col.role !== 'normal' : false
}

/** 列序号（不在列里返回 -1；终态列同样按顺序给序号，供漏斗比较用） */
export function columnIndex(id: string): number {
  return activeColumns.findIndex((c) => c.id === id)
}

/** 按角色取第一列（自动推进到成功/失败列时用） */
export function firstColumnByRole(role: BoardRole): BoardColumn | undefined {
  return activeColumns.find((c) => c.role === role)
}

/**
 * 下一列（「推进」用）：
 * - 当前是进行中列 → 下一个进行中列；已是最后一个进行中列 → 成功列
 * - 当前是终态列 → null（终态不再自动推进）
 */
export function nextColumnId(id: string): string | null {
  const current = activeColumn(id)
  if (!current || current.role !== 'normal') return null
  const normals = activeColumns.filter((c) => c.role === 'normal')
  const i = normals.findIndex((c) => c.id === id)
  if (i >= 0 && i < normals.length - 1) return normals[i + 1]!.id
  const success = firstColumnByRole('success')
  return success && success.id !== id ? success.id : null
}

/**
 * 列元信息（列头 / 徽章共用）。
 * 未配置的列（如历史 round_4、尚未补列的自定义 id）回退到内置命名，
 * 保证「卡片永远显示得像样」，不会白屏也不会只剩一个裸 id。
 */
export function columnMeta(id: string): ApplicationStatusMeta {
  const col = activeColumn(id)
  if (!col) {
    const role = legacyColumnRole(id)
    return {
      label: legacyColumnName(id),
      desc: ROLE_LABELS[role],
      terminal: role !== 'normal',
      ...ROLE_STYLES[role],
    }
  }
  return {
    label: col.name,
    desc: ROLE_LABELS[col.role],
    terminal: col.role !== 'normal',
    ...ROLE_STYLES[col.role],
  }
}

/**
 * 数据里出现、但列配置里没有的 status → 自动补列（插在终态列之前）。
 * 保证「卡片永远不会因为列配置丢失而看不见」。
 */
export function ensureColumnsForData(
  columns: BoardColumn[],
  apps: Array<{ status: string }>,
): BoardColumn[] {
  const known = new Set(columns.map((c) => c.id))
  const missing: BoardColumn[] = []
  for (const app of apps) {
    const id = app.status
    if (!isValidColumnId(id) || known.has(id)) continue
    known.add(id)
    missing.push({ id: id.trim(), name: legacyColumnName(id.trim()), role: legacyColumnRole(id.trim()) })
  }
  if (!missing.length) return columns
  const terminalStart = columns.findIndex((c) => c.role !== 'normal')
  if (terminalStart < 0) return [...columns, ...missing]
  return [...columns.slice(0, terminalStart), ...missing, ...columns.slice(terminalStart)]
}

/** 重排（把 from 位置的列移到 to 位置），越界自动收敛 */
export function moveColumn(columns: BoardColumn[], from: number, to: number): BoardColumn[] {
  if (from === to || from < 0 || from >= columns.length) return columns
  const next = [...columns]
  const [item] = next.splice(from, 1)
  if (!item) return columns
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}
