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
  /** 开源 SVG 图标路径（Lucide，MIT 许可），24×24 viewBox */
  icon: string
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
    icon: 'M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z',
  },
  {
    key: 'tracking',
    code: 'B',
    title: '投递看板',
    desc: '岗位采集 · 状态机流转 · 特化简历',
    path: '/tracking',
    priority: 'P0',
    icon: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  },
  {
    key: 'interview',
    code: 'C',
    title: '面试复盘',
    desc: '轮次记录 · AI 复盘 · 面经题库',
    path: '/interview',
    priority: 'P0',
    icon: 'M8 2h8v4H8ZM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01',
  },
  {
    key: 'automation',
    code: 'D',
    title: '自动投递',
    desc: '浏览器插件 · 表单填充 · 人工确认',
    path: '/automation',
    priority: 'P0',
    icon: 'M3 7l9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10',
  },
  {
    key: 'ai',
    code: 'E',
    title: 'AI 助手',
    desc: '素材提炼 · 简历润色 · JD 语义匹配',
    path: '/ai',
    priority: 'P1',
    icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z',
  },
  {
    key: 'growth',
    code: 'F',
    title: '成长追踪',
    desc: '转化漏斗 · 短板分析 · 学习计划',
    path: '/growth',
    priority: 'P1',
    icon: 'M12 20V10M18 20V4M6 20v-4',
  },
  {
    key: 'card',
    code: 'A5',
    title: '个人名片',
    desc: '对外名片页 · 一键导出静态 HTML',
    path: '/card',
    priority: 'P1',
    icon: 'M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8ZM6.17 15.99a3 3 0 1 1 5.66 0M15 12h.01M16 10h2M16 14h2',
  },
  {
    key: 'settings',
    code: '—',
    title: '设置',
    desc: 'AI 双模式 · 隐私授权 · 数据导出',
    path: '/settings',
    priority: 'P0',
    icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  },
]
