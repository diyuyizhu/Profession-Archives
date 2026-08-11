/**
 * 档案领域 demo 种子数据（前端 localStorage 版默认档案）。
 * 贴合目标用户画像（网络安全 / 前端 JS 分析方向），
 * 覆盖 技能 / 经历 / 教育 / 项目 / 日记 / 成就 / 里程碑 全类型，
 * 供首屏聚合名片与名片页直接展示。
 */
import type { Profile } from '@pa/shared'

export function nowIso(): string {
  return new Date().toISOString()
}

/** 生成 id（demo 场景够用；server 版用 crypto.randomUUID） */
export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/** 空档案（首次启动不预置示例数据；用户从零开始） */
export function buildEmptyProfile(): Profile {
  const ts = nowIso()
  return {
    id: uid('pf'),
    full_name: '',
    headline: '',
    email: '',
    phone: '',
    summary: '',
    skills: [],
    experiences: [],
    education: [],
    projects: [],
    journal: [],
    card_theme: 'trae',
    created_at: ts,
    updated_at: ts,
  }
}

const ts = nowIso()

export function buildDemoProfile(): Profile {
  return {
    id: 'demo-profile',
    full_name: '林小安',
    headline: 'Web 安全工程师 · 渗透测试 · 前端安全分析',
    email: 'lin.xiaoan@example.com',
    phone: '138-0000-0000',
    summary:
      '专注 Web 安全与渗透测试的安全工程师，擅长前端 JS 漏洞分析与测试报告撰写。坚持本地优先、隐私可控的工具构建，长期记录职业成长。',
    skills: [
      { id: uid('sk'), name: '渗透测试', category: '安全', level: 4, tags: ['安全', 'Web'] },
      { id: uid('sk'), name: 'Web 安全', category: '安全', level: 4, tags: ['安全'] },
      { id: uid('sk'), name: 'JavaScript 逆向', category: '前端', level: 3, tags: ['前端', 'JS'] },
      { id: uid('sk'), name: 'Python 脚本', category: '开发', level: 4, tags: ['开发', 'Python'] },
      { id: uid('sk'), name: 'Burp Suite', category: '工具', level: 4, tags: ['工具'] },
    ],
    experiences: [
      {
        id: uid('ex'),
        role: '安全测试工程师',
        company: '某安全实验室',
        description_md: '负责企业 Web 应用渗透测试，完成 20+ 项目安全评估；编写自动化扫描脚本提升回归效率 40%。',
        tags: ['渗透测试', 'Web'],
        start_date: '2023-04',
      },
      {
        id: uid('ex'),
        role: '安全实习生',
        company: '某互联网公司',
        description_md: '参与前端 JS 逻辑漏洞挖掘，输出漏洞报告与修复建议；搭建本地测试环境。',
        tags: ['前端', '安全'],
        start_date: '2022-07',
        end_date: '2023-03',
      },
    ],
    education: [
      {
        id: uid('ed'),
        school: '示例大学',
        degree: '本科',
        major: '网络空间安全',
        start_date: '2019-09',
        end_date: '2023-06',
        description: '主修 Web 安全、密码学与系统安全。',
      },
    ],
    projects: [
      {
        id: uid('pr'),
        name: '本地渗透报告生成器',
        summary: '将测试发现自动汇总为结构化报告',
        description_md: '用 Python + Markdown 模板自动生成渗透测试报告，支持截图与证据归档。',
        tags: ['Python', '工具'],
        attachments: [],
      },
      {
        id: uid('pr'),
        name: '前端 JS 逻辑分析工具',
        summary: '批量识别前端业务逻辑漏洞',
        description_md: '半自动化分析前端 JS 中的鉴权与业务逻辑缺陷，辅助手工渗透。',
        tags: ['前端', 'JS', '安全'],
        attachments: [],
      },
    ],
    journal: [
      {
        id: uid('jn'),
        entry_type: 'milestone',
        title: '获得首张 OSCP 证书',
        content_md: '历时 4 个月备考，完成 5 个靶场，收获渗透测试核心方法论。',
        occurred_at: '2024-06-15',
        tags: ['证书', '安全'],
        attachments: [],
        created_at: ts,
        updated_at: ts,
      },
      {
        id: uid('jn'),
        entry_type: 'achievement',
        title: '自动化报告脚本上线',
        content_md: '报告生成时间从 2 小时缩短到 30 分钟，团队内推广使用。',
        occurred_at: '2024-09-02',
        tags: ['效率', 'Python'],
        attachments: [],
        created_at: ts,
        updated_at: ts,
      },
      {
        id: uid('jn'),
        entry_type: 'journal',
        title: '完成一次 XSS 绕过记录',
        content_md: '在真实项目中绕过 WAF 检测，总结编码绕过手法并整理成笔记。',
        occurred_at: '2025-03-18',
        tags: ['XSS', 'WAF'],
        attachments: [],
        created_at: ts,
        updated_at: ts,
      },
      {
        id: uid('jn'),
        entry_type: 'achievement',
        title: '开源工具获得 500+ Star',
        content_md: '本地渗透报告生成器开源后获得社区认可，收到多份改进建议。',
        occurred_at: '2025-11-08',
        tags: ['开源', 'Python'],
        attachments: [],
        created_at: ts,
        updated_at: ts,
      },
    ],
    card_theme: 'trae',
    created_at: ts,
    updated_at: ts,
  }
}
