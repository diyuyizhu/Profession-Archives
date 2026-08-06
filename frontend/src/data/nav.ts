/**
 * 侧边栏导航菜单树：一二级菜单（按 README 功能模块细分）。
 * 数据驱动：侧栏渲染、路由生成、页面高亮共用一份数据。
 * 一级图标从 @pa/shared MODULES 复用（单一来源，避免两份数据漂移）。
 */
import { MODULES } from '@pa/shared'

/** 按 key 取模块图标（缺失时回退空串，兜底防错） */
function iconOf(key: string): string {
  return MODULES.find((m) => m.key === key)?.icon ?? ''
}

export interface NavChild {
  /** 子项 id（路由 name） */
  id: string
  /** 显示名称 */
  title: string
  /** 路由路径 */
  path: string
  /** 对应 README 功能点（如 A1/A2），用于占位页展示 */
  feature?: string
}

export interface NavItem {
  /** 模块 key */
  key: string
  /** 模块代号（A/B/C/D/E/F/A5/—） */
  code: string
  /** 一级标题 */
  title: string
  /** 模块总路由（点击一级标题跳转） */
  path: string
  /** 开源 SVG 图标（Lucide，MIT 许可），24×24 viewBox */
  icon: string
  /** 二级子项（README 功能模块细分） */
  children: NavChild[]
}

export const NAV_TREE: NavItem[] = [
  {
    key: 'archive',
    code: 'A',
    title: '生涯档案',
    path: '/archive',
    icon: iconOf('archive'),
    children: [
      { id: 'archive-journal', title: '日记 / 成就 / 里程碑', path: '/archive/journal', feature: 'A1 原子化记录' },
      { id: 'archive-timeline', title: '生涯时间线', path: '/archive/timeline', feature: 'A4 时间线视图' },
      { id: 'archive-tags', title: '标签管理', path: '/archive/tags', feature: 'A2 聚合名片·标签' },
    ],
  },
  {
    key: 'tracking',
    code: 'B',
    title: '投递看板',
    path: '/tracking',
    icon: iconOf('tracking'),
    children: [
      { id: 'tracking-board', title: '看板视图', path: '/tracking/board', feature: 'B1 状态机看板' },
      { id: 'tracking-collect', title: '岗位采集', path: '/tracking/collect', feature: 'B2 岗位采集' },
      { id: 'tracking-resume', title: '特化简历', path: '/tracking/resume', feature: 'B3 简历生成' },
      { id: 'tracking-stats', title: '投递统计', path: '/tracking/stats', feature: 'B4 转化统计' },
    ],
  },
  {
    key: 'interview',
    code: 'C',
    title: '面试复盘',
    path: '/interview',
    icon: iconOf('interview'),
    children: [
      { id: 'interview-record', title: '面试记录', path: '/interview/record', feature: 'C1/C2 轮次记录与状态流转' },
      { id: 'interview-review', title: 'AI 复盘', path: '/interview/review', feature: 'C3 面试复盘' },
      { id: 'interview-question-bank', title: '面经题库', path: '/interview/question-bank', feature: 'C4 面经题库' },
    ],
  },
  {
    key: 'automation',
    code: 'D',
    title: '自动投递',
    path: '/automation',
    icon: iconOf('automation'),
    children: [
      { id: 'automation-plugin', title: '插件配对', path: '/automation/plugin', feature: 'D1/D2 本地桥与插件' },
      { id: 'automation-mapping', title: '字段映射', path: '/automation/mapping', feature: 'D4 字段映射记忆' },
    ],
  },
  {
    key: 'ai',
    code: 'E',
    title: 'AI 助手',
    path: '/ai',
    icon: iconOf('ai'),
    children: [
      { id: 'ai-extract', title: '素材提炼', path: '/ai/extract', feature: 'E2 素材提炼' },
      { id: 'ai-polish', title: '简历润色', path: '/ai/polish', feature: 'E2 简历润色' },
      { id: 'ai-match', title: 'JD 语义匹配', path: '/ai/match', feature: 'E2 JD 匹配' },
    ],
  },
  {
    key: 'growth',
    code: 'F',
    title: '成长追踪',
    path: '/growth',
    icon: iconOf('growth'),
    children: [
      { id: 'growth-funnel', title: '转化漏斗', path: '/growth/funnel', feature: 'F1 路线分析' },
      { id: 'growth-learning', title: '学习计划', path: '/growth/learning', feature: 'F2 短板补足' },
      { id: 'growth-skills', title: '技能追踪', path: '/growth/skills', feature: 'F3 提升追踪' },
    ],
  },
  {
    key: 'card',
    code: 'A5',
    title: '个人名片',
    path: '/card',
    icon: iconOf('card'),
    children: [
      { id: 'card-preview', title: '名片预览', path: '/card/preview', feature: 'A5 对外名片页' },
      { id: 'card-export', title: '导出 HTML', path: '/card/export', feature: 'A5 静态导出' },
    ],
  },
  {
    key: 'settings',
    code: '—',
    title: '设置',
    path: '/settings',
    icon: iconOf('settings'),
    children: [
      { id: 'settings-ai', title: 'AI 配置', path: '/settings/ai', feature: 'E1 双模式配置' },
      { id: 'settings-privacy', title: '隐私授权', path: '/settings/privacy', feature: 'E3 隐私提示' },
      { id: 'settings-data', title: '数据管理', path: '/settings/data', feature: '导出/备份' },
    ],
  },
]

/** 所有子路由（路由表生成用） */
export const NAV_CHILDREN = NAV_TREE.flatMap((item) => item.children)
