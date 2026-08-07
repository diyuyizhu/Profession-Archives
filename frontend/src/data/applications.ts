/**
 * 投递领域 demo 种子数据（前端 localStorage 版默认看板）。
 * 覆盖 备选/已投/简历被读/一面…终面/Offer/拒绝/放弃 全状态，
 * 每条附带完整状态迁移路径，供漏斗（F1）精确还原。
 * 轮次阶段用 round_1..round_8 动态编号，total_rounds 决定终面。
 */
import type { Application, ApplicationEvent, ApplicationStatus } from '@pa/shared'

import { uid } from './seed'

interface DemoAppDef extends Omit<Application, 'id' | 'created_at' | 'updated_at'> {
  /** 该投递经历的状态路径（自创建起按序），用于生成事件日志 */
  path: ApplicationStatus[]
}

const now = new Date().toISOString()

const DEFS: DemoAppDef[] = [
  {
    company: '奇点科技',
    title: 'Web 安全工程师',
    url: 'https://qidian.example.com/jobs/pa-01',
    jd: '负责 Web 应用渗透测试与安全评估，熟悉 OWASP Top 10，掌握 Burp Suite，有前端 JS 分析经验优先。',
    channel: '官网',
    apply_method: 'official_form',
    status: 'round_2',
    total_rounds: 3,
    importance: 2,
    tags: ['Web安全', '渗透测试'],
    notes: '一面已过，HR 约二面。',
    applied_at: '2026-07-28',
    path: ['backlog', 'applied', 'viewed', 'round_1', 'round_2'],
  },
  {
    company: '天工智能',
    title: '应用安全工程师',
    channel: '官网',
    jd: '应用安全评估与代码审计，SDL 流程建设。',
    status: 'round_3',
    total_rounds: 4,
    importance: 1,
    tags: ['代码审计', 'SDL'],
    notes: '终面进行中（四面）。',
    applied_at: '2026-07-08',
    path: ['backlog', 'applied', 'viewed', 'round_1', 'round_2', 'round_3'],
  },
  {
    company: '远山云',
    title: '渗透测试工程师',
    channel: '内推',
    jd: '云上安全测试，攻防演练。',
    status: 'offer',
    total_rounds: 3,
    importance: 1,
    tags: ['渗透测试', '云安全'],
    notes: '拿到 Offer，薪资 28k × 14。',
    applied_at: '2026-06-15',
    path: ['backlog', 'applied', 'viewed', 'round_1', 'round_2', 'round_3', 'offer'],
  },
  {
    company: '数据星河',
    title: '前端安全分析工程师',
    channel: 'BOSS 直聘',
    apply_method: 'ats',
    jd: '前端 JS 逻辑漏洞挖掘，业务安全。',
    status: 'viewed',
    total_rounds: 2,
    importance: 3,
    tags: ['前端', 'JS'],
    notes: '',
    applied_at: '2026-07-20',
    path: ['backlog', 'applied', 'viewed'],
  },
  {
    company: '蓝湖安全',
    title: '安全研究工程师',
    channel: '官网',
    jd: '安全研究方向，二进制方向优先。',
    status: 'rejected',
    total_rounds: 3,
    tags: ['安全研究'],
    notes: '研究方向不匹配。',
    reject_reason: '方向不符',
    applied_at: '2026-05-22',
    path: ['backlog', 'applied', 'viewed', 'rejected'],
  },
  {
    company: '云帆科技',
    title: '应用安全工程师',
    channel: 'BOSS 直聘',
    jd: '需要 3 年以上实战经验。',
    status: 'rejected',
    total_rounds: 2,
    tags: ['应用安全'],
    notes: '',
    reject_reason: '经验不足',
    applied_at: '2026-04-18',
    path: ['backlog', 'applied', 'rejected'],
  },
  {
    company: '极光实验室',
    title: '红队工程师',
    channel: '猎聘',
    jd: '红队攻防、内网渗透。',
    status: 'applied',
    total_rounds: 3,
    importance: 2,
    tags: ['红队'],
    notes: '',
    applied_at: '2026-08-02',
    path: ['backlog', 'applied'],
  },
  {
    company: '深蓝数据',
    title: 'JS 逆向工程师',
    channel: '内推',
    jd: '前端加密逆向，反爬对抗方向。',
    status: 'withdrawn',
    total_rounds: 3,
    tags: ['逆向'],
    notes: '与职业方向不符，主动放弃。',
    applied_at: '2026-06-30',
    path: ['backlog', 'applied', 'withdrawn'],
  },
  {
    company: '星海网络',
    title: '安全测试实习生',
    channel: 'BOSS 直聘',
    jd: '安全测试实习，配合团队渗透。',
    status: 'backlog',
    total_rounds: 2,
    tags: ['实习'],
    notes: '备选池，等 JD 更新再投。',
    path: ['backlog'],
  },
]

/** demo 投递列表 */
export function buildDemoApplications(): Application[] {
  return DEFS.map(({ path: _path, ...app }) => ({
    ...app,
    id: uid('ap'),
    created_at: now,
    updated_at: now,
  }))
}

/** demo 状态事件（由各投递的 path 生成，保证与当前状态一致） */
export function buildDemoEvents(apps: Application[]): ApplicationEvent[] {
  const events: ApplicationEvent[] = []
  DEFS.forEach((def, i) => {
    const app = apps[i]
    if (!app) return
    let from: ApplicationStatus | null = null
    for (const to of def.path) {
      events.push({ id: uid('ev'), application_id: app.id, from, to, at: now })
      from = to
    }
  })
  return events
}
