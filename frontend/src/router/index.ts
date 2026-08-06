import { createRouter, createWebHashHistory } from 'vue-router'

import { NAV_CHILDREN } from '@/data/nav'

/**
 * 路由表：主界面（/）+ 各功能模块一二级路由。
 * hash 模式 —— 将来便携版 file:// 分发最稳，不依赖服务端 rewrite。
 * 二级路由由 NAV_CHILDREN 数据驱动生成，统一用 PlaceholderView 占位。
 */
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '主控台' },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '生涯档案', code: 'A', milestone: 'M1' },
  },
  {
    path: '/tracking',
    name: 'tracking',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '投递看板', code: 'B', milestone: 'M1/M2/M3' },
  },
  {
    path: '/interview',
    name: 'interview',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '面试复盘', code: 'C', milestone: 'M3' },
  },
  {
    path: '/automation',
    name: 'automation',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '自动投递', code: 'D', milestone: 'M4' },
  },
  {
    path: '/ai',
    name: 'ai',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: 'AI 助手', code: 'E', milestone: 'M2' },
  },
  {
    path: '/growth',
    name: 'growth',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '成长追踪', code: 'F', milestone: 'M3/M5' },
  },
  {
    path: '/card',
    name: 'card',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '个人名片', code: 'A5', milestone: 'M5' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: '设置', code: '—', milestone: 'M1' },
  },
  // 二级子路由：由 nav.ts 数据驱动，占位页展示对应功能点
  ...NAV_CHILDREN.map((child) => ({
    path: child.path,
    name: child.id,
    component: () => import('../views/PlaceholderView.vue'),
    meta: { title: child.title, code: '子', milestone: child.feature ?? 'M1–M5' },
  })),
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
