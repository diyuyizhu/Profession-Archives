/**
 * 侧边栏导航（一级菜单）：按 README 功能模块（A–F + A5 + 设置）。
 * 模块内的细分功能不再放侧栏二级，改由各模块主视图顶部的 ModuleTabs 承载。
 * 一级图标从 @pa/shared MODULES 复用（单一来源）。
 */
import { MODULES } from '@pa/shared'

/** 按 key 取模块图标（缺失时回退空串，兜底防错） */
function iconOf(key: string): string {
  return MODULES.find((m) => m.key === key)?.icon ?? ''
}

export interface NavItem {
  /** 模块 key */
  key: string
  /** 模块代号（A/B/C/D/E/F/A5/—） */
  code: string
  /** 一级标题 */
  title: string
  /** 模块总路由 */
  path: string
  /** 开源 SVG 图标（Lucide，MIT 许可），24×24 viewBox */
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'archive', code: 'A', title: '我的档案', path: '/archive', icon: iconOf('archive') },
  { key: 'tracking', code: 'B', title: '投递看板', path: '/tracking', icon: iconOf('tracking') },
  {
    key: 'jobs',
    code: 'G',
    title: '岗位市场',
    path: '/job-market',
    // 公文包（Lucide briefcase，MIT）
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  },
  { key: 'resume', code: 'E', title: '简历', path: '/resume', icon: iconOf('ai') },
  { key: 'automation', code: 'D', title: '自动投递', path: '/automation', icon: iconOf('automation') },
  { key: 'growth', code: 'F', title: '成长追踪', path: '/growth', icon: iconOf('growth') },
  { key: 'card', code: 'A5', title: '个人名片', path: '/card', icon: iconOf('card') },
  { key: 'knowledge', code: 'K', title: '知识库', path: '/knowledge', icon: iconOf('knowledge') },
  { key: 'settings', code: '—', title: '设置', path: '/settings', icon: iconOf('settings') },
]
