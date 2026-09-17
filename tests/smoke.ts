/**
 * Integration 冒烟测试：覆盖 shared 关键流程 + server 核心逻辑。
 * 运行：npx tsx tests/smoke.ts
 */
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  boardStages,
  buildApplicationStats,
  canTransition,
  isTerminal,
  isValidStatus,
  nextStage,
  statusMeta,
} from '../shared/src/application.ts'
import { applyInterviewResult, nextRoundNumber } from '../shared/src/interview.ts'
import {
  DEFAULT_BOARD_COLUMNS,
  ensureColumnsForData,
  getActiveBoardColumns,
  moveColumn,
  setActiveBoardColumns,
} from '../shared/src/board.ts'
import type { BoardColumn, PropertyDef } from '../shared/src/index.ts'
import {
  createView,
  findField,
  isValuelessOperator,
  matchesFilter,
  normalizeView,
  operatorsFor,
  resolveFields,
  sortApplications,
} from '../shared/src/property.ts'
import { parseEmailForApplication } from '../shared/src/email.ts'
import { buildResumeDraft, matchJdToProfile, extractHighlights } from '../shared/src/ai.ts'
import { groupSkillHistory, planProgress } from '../shared/src/skill.ts'
import type { Application, ApplicationEvent, Profile } from '../shared/src/index.ts'

// server 冒烟测试用临时数据目录：避免把测试档案（"冒烟"）写进真实 .pa-data
process.env.PA_DATA_DIR = path.join(tmpdir(), 'pa-smoke-' + Date.now())

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
  console.log('== shared: 看板列（内置默认）==')
  assert(isValidStatus('backlog') && isValidStatus('col_abc123'), '合法列 id（含自定义列）')
  assert(!isValidStatus('') && !isValidStatus('x'.repeat(65)), '空 / 超长列 id 非法')
  assert(nextStage('viewed') === 'round_1', '被读→第 1 面')
  assert(nextStage('round_2') === 'round_3', '第 2 面→第 3 面')
  assert(nextStage('round_3') === 'offer', '最后一个进行中列→成功列')
  assert(nextStage('offer') === null, '终态列不再推进')
  assert(!canTransition('round_1', 'round_1'), '原地不动不算迁移')
  assert(canTransition('round_4', 'round_2'), '列可自由移动（含回退修正）')
  assert(statusMeta('offer').terminal && !statusMeta('applied').terminal, '终态由列角色决定')
  assert(statusMeta('round_4').label === '第 4 面', '未配置的历史列回退到内置命名')

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

  console.log('== shared: 自定义看板列 ==')
  const custom: BoardColumn[] = [
    { id: 'inbox', name: '收件箱', role: 'normal' },
    { id: 'chat', name: '沟通中', role: 'normal' },
    { id: 'done', name: '拿到', role: 'success' },
    { id: 'no', name: '没了', role: 'failure' },
  ]
  setActiveBoardColumns(custom)
  assert(nextStage('inbox') === 'chat', '列顺序决定推进')
  assert(nextStage('chat') === 'done', '最后一个进行中列→成功列')
  assert(canTransition('no', 'inbox'), '可从终态列拉回修正')
  assert(statusMeta('chat').label === '沟通中', '列名即显示名')
  assert(isTerminal('done') && isTerminal('no') && !isTerminal('chat'), 'success/failure 为终态列')
  assert(getActiveBoardColumns().length === 4, '注册表随 setActiveBoardColumns 更新')
  assert(applyInterviewResult('inbox', 'passed') === 'chat', 'C2 通过→下一列')
  assert(applyInterviewResult('chat', 'passed') === 'done', 'C2 最后一列通过→成功列')
  assert(applyInterviewResult('inbox', 'failed') === 'no', 'C2 未通过→失败列')
  assert(applyInterviewResult('done', 'passed') === null, '终态列不流转')
  // 数据里出现配置中没有的列 → 自动补列（卡片不会因删列配置而消失）
  const patched = ensureColumnsForData(custom, [{ status: 'legacy_col' }])
  assert(patched.some((c) => c.id === 'legacy_col'), '未知列自动补列')
  assert(patched.findIndex((c) => c.id === 'legacy_col') < patched.findIndex((c) => c.id === 'done'), '补列插在终态列之前')
  assert(moveColumn(custom, 0, 2).map((c) => c.id).join() === 'chat,done,inbox,no', '列重排')

  console.log('== shared: 多维表格（自定义属性 / 筛选 / 排序 / 视图）==')
  const propDefs: PropertyDef[] = [
    { id: 'prop_a', name: '是否内推', type: 'checkbox' },
    { id: 'prop_b', name: '期望薪资', type: 'number' },
    { id: 'prop_c', name: '优先级', type: 'select', options: [{ id: 'o1', name: '高' }, { id: 'o2', name: '低' }] },
    { id: 'prop_d', name: '技能', type: 'multi_select', options: [] },
    { id: 'prop_e', name: '跟进日期', type: 'date' },
  ]
  const ts2 = new Date().toISOString()
  const rows: Application[] = [
    { id: 'r1', company: '甲公司', title: 'A', status: 'applied', tags: [], notes: '', created_at: ts2, updated_at: ts2, properties: { prop_a: true, prop_b: 30, prop_c: '高', prop_d: ['Vue', 'TS'], prop_e: '2026-08-01' } },
    { id: 'r2', company: '乙公司', title: 'B', status: 'backlog', tags: [], notes: '', created_at: ts2, updated_at: ts2, properties: { prop_b: 20, prop_c: '低', prop_d: ['Go'] } },
    { id: 'r3', company: '丙公司', title: 'C', status: 'offer', tags: [], notes: '', created_at: ts2, updated_at: ts2 },
  ]
  const fields = resolveFields(propDefs)
  assert(fields.some((f) => f.key === 'prop_a' && f.kind === 'boolean' && f.custom), '自定义属性解析为字段')
  assert(findField(propDefs, 'company')?.kind === 'text' && !findField(propDefs, 'company')?.custom, '内置字段保留且非自定义')

  const cond = (field: string, operator: string, value?: string) => ({
    id: `c_${field}_${operator}`,
    field,
    operator: operator as never,
    value,
  })
  assert(matchesFilter(rows[0]!, { op: 'and', conditions: [cond('prop_a', 'is_true')] }), '勾选框筛选（已勾选）')
  assert(!matchesFilter(rows[1]!, { op: 'and', conditions: [cond('prop_a', 'is_true')] }), '勾选框筛选（未勾选被排除）')
  assert(matchesFilter(rows[1]!, { op: 'and', conditions: [cond('prop_b', 'lt', '25')] }), '数字小于')
  assert(matchesFilter(rows[0]!, { op: 'and', conditions: [cond('prop_d', 'contains', 'Vue')] }), '多选按元素精确匹配')
  assert(!matchesFilter(rows[1]!, { op: 'and', conditions: [cond('prop_d', 'contains', 'Vue')] }), '多选不含则不匹配')
  assert(matchesFilter(rows[0]!, { op: 'and', conditions: [cond('company', 'contains', '甲')] }), '内置字段参与筛选')
  assert(matchesFilter(rows[2]!, { op: 'and', conditions: [cond('prop_e', 'is_empty')] }), '空值筛选')
  assert(
    matchesFilter(rows[1]!, {
      op: 'or',
      conditions: [cond('company', 'contains', '甲'), cond('company', 'contains', '乙')],
    }),
    'OR 组合条件',
  )

  const sorted = sortApplications(rows, [{ field: 'prop_b', desc: true }])
  assert(sorted[0]!.id === 'r1' && sorted[2]!.id === 'r3', '自定义数字列倒序（空值恒排最后）')
  const byTitle = sortApplications(rows, [{ field: 'title', desc: false }]).map((a) => a.id).join()
  assert(byTitle === 'r1,r2,r3', '按内置字段升序')

  assert(operatorsFor('number').includes('gt') && !operatorsFor('boolean').includes('contains'), '运算符按字段形态收敛')
  assert(isValuelessOperator('is_empty') && !isValuelessOperator('contains'), '免值运算符判定')

  const view = createView('本周投递')
  assert(view.kind === 'table' && view.filter.conditions.length === 0 && view.hidden.length === 0, '新建视图默认值')
  const normalized = normalizeView({
    id: 'v1',
    name: 'x',
    kind: 'board',
    hidden: ['prop_a', 3],
    sorts: [{ field: 'prop_b', desc: true }, {}],
    filter: { op: 'or', conditions: [{ field: 'company', operator: 'contains' }] },
  })
  assert(
    normalized?.kind === 'board' && normalized.hidden.length === 1 && normalized.sorts.length === 1 && normalized.filter.op === 'or',
    '视图结构校验（丢弃脏数据）',
  )

  console.log('== shared: 面试 ==')
  setActiveBoardColumns(DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c })))
  assert(applyInterviewResult('round_2', 'passed') === 'round_3', 'C2 通过推进')
  assert(applyInterviewResult('round_3', 'passed') === 'offer', '最后一轮通过→Offer')
  assert(applyInterviewResult('rejected', 'passed') === null, '终态不流转')
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
  const p1 = upsertProfile({ full_name: '冒烟', skills: [], experiences: [], education: [], projects: [], journal: [], card_theme: 'classic' })
  const p2 = upsertProfile({ full_name: '冒烟', skills: [], experiences: [], education: [], projects: [], journal: [], card_theme: 'classic' })
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
