/**
 * Integration 冒烟测试：覆盖 shared 关键流程 + server 核心逻辑。
 * 运行：npx tsx tests/smoke.ts
 */
import {
  boardStages,
  buildApplicationStats,
  canTransition,
  isValidStatus,
  nextStage,
  statusMeta,
} from '../shared/src/application.ts'
import { applyInterviewResult, nextRoundNumber } from '../shared/src/interview.ts'
import { parseEmailForApplication } from '../shared/src/email.ts'
import { buildResumeDraft, matchJdToProfile, extractHighlights } from '../shared/src/ai.ts'
import { groupSkillHistory, planProgress } from '../shared/src/skill.ts'
import type { Application, ApplicationEvent, Profile } from '../shared/src/index.ts'

let passed = 0
let failed = 0
function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++
    console.log(`  ok: ${msg}`)
  } else {
    failed++
    console.error(`  FAIL: ${msg}`)
  }
}

async function main(): Promise<void> {
  console.log('== shared: 状态机（动态轮次）==')
  assert(isValidStatus('round_8') && !isValidStatus('round_9') && !isValidStatus('final'), '状态合法性')
  assert(nextStage('viewed', 3) === 'round_1', '被读→一面')
  assert(nextStage('round_2', 3) === 'round_3', '二面→三面')
  assert(nextStage('round_3', 3) === null, '最后一轮不再推进')
  assert(canTransition('round_1' as never, 'round_4' as never), '跳级前进')
  assert(!canTransition('round_4' as never, 'round_2' as never), '后退禁止')
  assert(statusMeta('round_4').label === '第 4 面', '默认非终面')
  assert(statusMeta('round_4', 4).label === '终面', '传 total=4 为终面')

  console.log('== shared: 统计 / 漏斗 / 看板列 ==')
  const ts = new Date().toISOString()
  const apps: Application[] = [
    { id: 'a', company: 'X', title: 't', status: 'round_3', total_rounds: 3, tags: [], notes: '', applied_at: '2026-07-01', created_at: ts, updated_at: ts },
    { id: 'b', company: 'Y', title: 't', status: 'offer', total_rounds: 3, tags: [], notes: '', applied_at: '2026-06-01', created_at: ts, updated_at: ts },
    { id: 'c', company: 'Z', title: 't', status: 'backlog', tags: [], notes: '', created_at: ts, updated_at: ts },
  ]
  const events: ApplicationEvent[] = [
    { id: 'e1', application_id: 'a', from: 'backlog', to: 'applied', at: ts },
    { id: 'e2', application_id: 'a', from: 'applied', to: 'round_1', at: ts },
    { id: 'e3', application_id: 'b', from: 'backlog', to: 'round_3', at: ts },
  ]
  const stats = buildApplicationStats(apps, events)
  const cols = boardStages(apps)
  assert(cols.includes('round_1') && cols.includes('round_3'), '看板列含 round_1..round_3（终态投递不丢轮次）')
  const f = Object.fromEntries(stats.funnel.map((r) => [r.status, r.count]))
  assert(f.round_1 >= 2 && f.round_3 >= 1, '漏斗"曾经到达"（含终态投递）')
  assert(stats.byMonth[0]!.month.startsWith(String(new Date().getFullYear())), 'byMonth 最新在前')

  console.log('== shared: 面试 ==')
  assert(applyInterviewResult('round_2', 'passed', 3) === 'round_3', 'C2 通过推进')
  assert(applyInterviewResult('round_3', 'passed', 3) === 'offer', '最后一轮通过→Offer')
  assert(applyInterviewResult('rejected', 'passed', 3) === null, '终态不流转')
  const ivs = Array.from({ length: 9 }, (_, i) => ({ round: i + 1 })) as never
  assert(nextRoundNumber(ivs as never, 'x') <= 8, '轮次封顶 8')

  console.log('== shared: 邮箱解析 / AI ==')
  const email = parseEmailForApplication('奇点科技邀请您参加 Web 安全工程师岗位的面试，时间 2026年8月15日 14:00')
  assert(email.title === 'Web 安全工程师' && email.date === '2026-08-15', '邮箱解析岗位+日期')
  const profile: Profile = {
    id: 'p1', full_name: '张三', headline: '', email: '', phone: '', summary: '',
    skills: [{ id: 's1', name: '渗透测试', category: '', level: 4, tags: [] }],
    experiences: [{ id: 'e1', role: '安全工程师', company: 'X', description_md: 'Web 渗透测试与 Burp 使用。', tags: ['Web安全'], start_date: '2024-01', end_date: '', sort_order: 0 }],
    education: [], projects: [{ id: 'pr1', name: '漏洞扫描器', summary: '', description_md: '用 Python 实现自动化扫描。', tags: ['Python'], sort_order: 0 }],
    journal: [{ id: 'j1', entry_type: 'achievement', title: '修复高危漏洞', content_md: '主导修复某系统多个高危漏洞。', occurred_at: '2026-07-01', tags: [], attachments: [] }],
  }
  const m = matchJdToProfile('招聘渗透测试工程师，熟悉 Burp 与 Web 安全，有 Python 经验优先。', profile)
  assert(m.matched.includes('渗透测试') && m.matched.includes('Python'), 'JD 匹配覆盖技能+项目')
  const r = buildResumeDraft(profile, '渗透测试工程师，需要 Web 安全与 Python 经验。')
  assert(r.markdown.includes('# 张三') && r.markdown.includes('## 工作经历'), '简历草稿生成')
  assert(extractHighlights(profile.journal).bullets.length === 1, '素材提炼')

  console.log('== shared: 技能追踪 ==')
  const hist = groupSkillHistory([
    { id: '1', skill: '渗透测试', level: 2, recorded_at: '2026-01' },
    { id: '2', skill: '渗透测试', level: 4, recorded_at: '2026-07' },
  ])
  assert(hist[0]!.current === 4 && hist[0]!.history.length === 2, '技能轨迹聚合')
  assert(planProgress({ tasks: [{ done: true }, { done: false }] }).pct === 50, '计划进度')

  // ── server ──
  console.log('== server: 数据层 / AI 防护 ==')
  const { initSchema } = await import('../server/src/db.ts')
  const { upsertProfile, getProfile } = await import('../server/src/profile.ts')
  const { upsertAiConfig, callAi } = await import('../server/src/services/aiService.ts')
  initSchema()
  const p1 = upsertProfile({ full_name: '冒烟', skills: [], experiences: [], education: [], projects: [], journal: [], card_theme: 'trae' })
  const p2 = upsertProfile({ full_name: '冒烟', skills: [], experiences: [], education: [], projects: [], journal: [], card_theme: 'trae' })
  assert(p1.id === p2.id && getProfile(p1.id)?.full_name === '冒烟', '单档案 upsert（不重复）')
  upsertAiConfig({ provider: 'cloud', data_exit_consented: 1, cloud_api_key: 'sk', cloud_endpoint: 'http://169.254.169.254' })
  try {
    await callAi('polish', 'x')
    assert(false, 'SSRF 应拦截')
  } catch (e: unknown) {
    assert(/https|内网/.test(String((e as Error).message)), '云端内网 Endpoint 被拦截')
  }

  console.log(`\n结果：${passed} 通过，${failed} 失败`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('冒烟测试异常', e)
  process.exit(1)
})
