/**
 * @pa/shared —— 前后端共享契约（阶段 0 最小占位，后续按模块扩充）
 *
 * 规划：TS 类型 + Zod schema + 常量，被 server / frontend 共同引用。
 * 当前先放与界面主题、模块导航相关的常量，业务类型在 M1 档案领域实现时补齐。
 */

/** 界面主题名（预留多主题扩展，当前仅 Trae 默认风） */
export type ThemeName = 'trae'

/** 功能模块元信息（对应 README 模块 A–F + A5 + 设置） */
export interface ModuleMeta {
  /** 模块标识 */
  key: string
  /** 模块代号（A/B/C/D/E/F/A5/—） */
  code: string
  /** 中文名称 */
  title: string
  /** 一句话描述 */
  desc: string
  /** 路由路径 */
  path: string
  /** 优先级 P0/P1/P2 */
  priority: 'P0' | 'P1' | 'P2'
}

/** 主界面预留的功能入口（与 README 功能模块一一对应） */
export const MODULES: ModuleMeta[] = [
  {
    key: 'archive',
    code: 'A',
    title: '生涯档案',
    desc: '原子化记录 · 简历素材库 · 生涯时间线',
    path: '/archive',
    priority: 'P0',
  },
  {
    key: 'tracking',
    code: 'B',
    title: '投递看板',
    desc: '岗位采集 · 状态机流转 · 特化简历',
    path: '/tracking',
    priority: 'P0',
  },
  {
    key: 'interview',
    code: 'C',
    title: '面试复盘',
    desc: '轮次记录 · AI 复盘 · 面经题库',
    path: '/interview',
    priority: 'P0',
  },
  {
    key: 'automation',
    code: 'D',
    title: '自动投递',
    desc: '浏览器插件 · 表单填充 · 人工确认',
    path: '/automation',
    priority: 'P0',
  },
  {
    key: 'ai',
    code: 'E',
    title: 'AI 助手',
    desc: '素材提炼 · 简历润色 · JD 语义匹配',
    path: '/ai',
    priority: 'P1',
  },
  {
    key: 'growth',
    code: 'F',
    title: '成长追踪',
    desc: '转化漏斗 · 短板分析 · 学习计划',
    path: '/growth',
    priority: 'P1',
  },
  {
    key: 'card',
    code: 'A5',
    title: '个人名片',
    desc: '对外名片页 · 一键导出静态 HTML',
    path: '/card',
    priority: 'P1',
  },
  {
    key: 'settings',
    code: '—',
    title: '设置',
    desc: 'AI 双模式 · 隐私授权 · 数据导出',
    path: '/settings',
    priority: 'P0',
  },
]
