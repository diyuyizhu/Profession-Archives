import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 路由表：主界面（/）+ 各功能模块一级路由 + 模块内细分路由。
 * hash 模式 —— 将来便携版 file:// 分发最稳，不依赖服务端 rewrite。
 * 侧栏只有一级菜单；模块内细分（采集/统计/复盘/题库…）由各主视图顶部 ModuleTabs 承载。
 */
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '主控台' },
  },

  /* ── 生涯档案（A）：单页聚合（录入 + 时间线 + 聚合名片） ── */
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/ArchiveView.vue'),
    meta: { title: '生涯档案', code: 'A', milestone: 'M1' },
  },

  /* ── 投递看板（B） ── */
  {
    path: '/tracking',
    name: 'tracking',
    component: () => import('../views/TrackingBoardView.vue'),
    meta: { title: '投递看板', code: 'B', milestone: 'M1/M2/M3' },
  },
  {
    path: '/tracking/board',
    name: 'tracking-board',
    component: () => import('../views/TrackingBoardView.vue'),
    meta: { title: '看板视图', code: 'B1', milestone: 'M1' },
  },
  {
    path: '/tracking/collect',
    name: 'tracking-collect',
    component: () => import('../views/CollectView.vue'),
    meta: { title: '岗位采集', code: 'B2', milestone: 'M1' },
  },
  {
    path: '/tracking/stats',
    name: 'tracking-stats',
    component: () => import('../views/StatsView.vue'),
    meta: { title: '投递统计', code: 'B4', milestone: 'M3' },
  },
  {
    path: '/tracking/resume',
    name: 'tracking-resume',
    component: () => import('../views/ResumeView.vue'),
    meta: { title: '特化简历', code: 'B3', milestone: 'M2' },
  },
  {
    path: '/tracking/detail/:id',
    name: 'tracking-detail',
    component: () => import('../views/ApplicationDetailView.vue'),
    meta: { title: '投递详情', code: 'B', milestone: 'M1' },
  },

  /* ── 面试复盘（C） ── */
  {
    path: '/interview',
    name: 'interview',
    component: () => import('../views/InterviewRecordView.vue'),
    meta: { title: '面试复盘', code: 'C', milestone: 'M3' },
  },
  {
    path: '/interview/record',
    name: 'interview-record',
    component: () => import('../views/InterviewRecordView.vue'),
    meta: { title: '面试记录', code: 'C1/C2', milestone: 'M3' },
  },
  {
    path: '/interview/review',
    name: 'interview-review',
    component: () => import('../views/InterviewReviewView.vue'),
    meta: { title: 'AI 复盘', code: 'C3', milestone: 'M3' },
  },
  {
    path: '/interview/question-bank',
    name: 'interview-question-bank',
    component: () => import('../views/QuestionBankView.vue'),
    meta: { title: '面经题库', code: 'C4', milestone: 'M3' },
  },

  /* ── 自动投递（D） ── */
  {
    path: '/automation',
    name: 'automation',
    component: () => import('../views/AutomationPluginView.vue'),
    meta: { title: '自动投递', code: 'D', milestone: 'M4' },
  },
  {
    path: '/automation/plugin',
    name: 'automation-plugin',
    component: () => import('../views/AutomationPluginView.vue'),
    meta: { title: '插件配对', code: 'D1/D2', milestone: 'M4' },
  },
  {
    path: '/automation/mapping',
    name: 'automation-mapping',
    component: () => import('../views/AutomationMappingView.vue'),
    meta: { title: '字段映射', code: 'D4', milestone: 'M4' },
  },

  /* ── AI 助手（E） ── */
  {
    path: '/ai',
    name: 'ai',
    component: () => import('../views/AIExtractView.vue'),
    meta: { title: 'AI 助手', code: 'E', milestone: 'M2' },
  },
  {
    path: '/ai/extract',
    name: 'ai-extract',
    component: () => import('../views/AIExtractView.vue'),
    meta: { title: '素材提炼', code: 'E2', milestone: 'M2' },
  },
  {
    path: '/ai/polish',
    name: 'ai-polish',
    component: () => import('../views/AIPolishView.vue'),
    meta: { title: '简历润色', code: 'E2', milestone: 'M2' },
  },
  {
    path: '/ai/match',
    name: 'ai-match',
    component: () => import('../views/AIMatchView.vue'),
    meta: { title: 'JD 语义匹配', code: 'E2', milestone: 'M2' },
  },

  /* ── 成长追踪（F） ── */
  {
    path: '/growth',
    name: 'growth',
    component: () => import('../views/GrowthFunnelView.vue'),
    meta: { title: '成长追踪', code: 'F', milestone: 'M3/M5' },
  },
  {
    path: '/growth/funnel',
    name: 'growth-funnel',
    component: () => import('../views/GrowthFunnelView.vue'),
    meta: { title: '转化漏斗', code: 'F1', milestone: 'M3' },
  },
  {
    path: '/growth/learning',
    name: 'growth-learning',
    component: () => import('../views/GrowthLearningView.vue'),
    meta: { title: '学习计划', code: 'F2', milestone: 'M5' },
  },
  {
    path: '/growth/skills',
    name: 'growth-skills',
    component: () => import('../views/GrowthSkillsView.vue'),
    meta: { title: '技能追踪', code: 'F3', milestone: 'M5' },
  },

  /* ── 个人名片（A5）：单页（预览 + 导出） ── */
  {
    path: '/card',
    name: 'card',
    component: () => import('../views/CardView.vue'),
    meta: { title: '个人名片', code: 'A5', milestone: 'M5' },
  },

  /* ── 设置 ── */
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsAIView.vue'),
    meta: { title: '设置', code: '—', milestone: 'M1' },
  },
  {
    path: '/settings/ai',
    name: 'settings-ai',
    component: () => import('../views/SettingsAIView.vue'),
    meta: { title: 'AI 配置', code: 'E1', milestone: 'M2' },
  },
  {
    path: '/settings/privacy',
    name: 'settings-privacy',
    component: () => import('../views/SettingsPrivacyView.vue'),
    meta: { title: '隐私授权', code: 'E3', milestone: 'M2' },
  },
  {
    path: '/settings/data',
    name: 'settings-data',
    component: () => import('../views/SettingsDataView.vue'),
    meta: { title: '数据管理', code: '—', milestone: 'M1' },
  },

  // 兜底：旧链接 / 无效路径跳回主控台（避免 hash 路由下空白页）
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
