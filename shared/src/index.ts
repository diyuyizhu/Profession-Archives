/**
 * @pa/shared —— 前后端共享契约
 *
 * 规划：TS 类型 + Zod schema + 常量，被 server / frontend 共同引用。
 * 当前包含：界面主题 / 模块导航常量 + 档案领域（A 模块）业务类型。
 * 业务类型在 M1 档案领域实现时补齐，后续模块（B–F）按相同模式扩充。
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

/* ════════════════════════════════════════════════════════════
   档案领域（模块 A）类型契约 —— 前端 localStorage 版先行，
   字段与 server/Drizzle schema 对齐，后端落地后可无缝切换。
   ════════════════════════════════════════════════════════════ */

/** 技能 */
export interface Skill {
  id: string
  name: string
  /** 技能分类（编程语言 / 工具 / 安全 / 软技能…） */
  category?: string
  /** 自评等级 1–5 */
  level?: number
  tags: string[]
}

/** 工作经历 */
export interface Experience {
  id: string
  role: string
  company?: string
  description_md: string
  tags: string[]
  start_date?: string
  end_date?: string
}

/** 教育背景 */
export interface Education {
  id: string
  school: string
  degree?: string
  major?: string
  start_date?: string
  end_date?: string
  description?: string
}

/** 项目经历 */
export interface Project {
  id: string
  name: string
  summary?: string
  description_md: string
  tags: string[]
  attachments: string[]
  /** 起止时间（ISO 日期或 YYYY-MM） */
  start_date?: string
  end_date?: string
}

/** 日记 / 成就 / 里程碑 条目类型 */
export type JournalEntryType = 'journal' | 'achievement' | 'milestone'

/** 自定义池子（A1）：把原子笔记归类存放，如 项目实习 / 学校经历 / 技术栈 */
export interface Collection {
  id: string
  name: string
  /** 徽章文字色类 */
  color?: string
  created_at: string
}

/** 日记 / 成就 / 里程碑（A1 原子化记录） */
export interface JournalEntry {
  id: string
  entry_type: JournalEntryType
  title: string
  content_md: string
  /** 发生日期（ISO 日期字符串，如 2026-08-06） */
  occurred_at: string
  tags: string[]
  attachments: string[]
  /** 归属的池子（可选，见 Collection） */
  collection_id?: string
  created_at: string
  updated_at: string
}

/** 原子记录录入 / 编辑载荷 */
export interface JournalDraft {
  entry_type: JournalEntryType
  title: string
  content_md: string
  occurred_at: string
  tags: string[]
  collection_id?: string
}

/** 个人档案主表（原子化经历聚合的载体） */
export interface Profile {
  id: string
  full_name: string
  headline?: string
  email?: string
  phone?: string
  /** 个人简介 / summary */
  summary?: string
  skills: Skill[]
  experiences: Experience[]
  education: Education[]
  projects: Project[]
  /** 日记 / 成就 / 里程碑（A1） */
  journal: JournalEntry[]
  /** 当前使用的名片主题（A5，预留，默认 'trae'） */
  card_theme: string
  created_at: string
  updated_at: string
}

/** 创建 / 更新档案的载荷（全量，便于 localStorage 版直接替换） */
export type ProfilePayload = Omit<Profile, 'id' | 'created_at' | 'updated_at'>

/** 聚合名片（A2 / A5）：由档案实时聚合，供名片页与简历素材库展示 */
export interface CareerCardData {
  profile: Profile
  /** 按 entry_type 分组的日记/成就/里程碑 */
  journalByType: Record<JournalEntryType, JournalEntry[]>
  /** 全部标签 → 关联条目数（按出现频次排序） */
  tagCloud: Array<{ name: string; count: number }>
  /** 生涯时间线（A4 数据源）：按时间合并经历/教育/里程碑 */
  timeline: TimelineItem[]
  /** 简历素材库（A2）：日记/成就中可用素材（按摘要截取） */
  materialCount: number
}

/** 时间线条目（A4）：来源 = 经历 / 教育 / 里程碑，按发生时间合并排序 */
export interface TimelineItem {
  kind: 'experience' | 'education' | 'milestone' | 'project'
  title: string
  subtitle?: string
  date: string
  tags: string[]
  /** 摘要（正文截断） */
  snippet: string
}

/* ════════════════════════════════════════════════════════════
   求职投递领域（模块 B）类型契约 —— 前端 localStorage 版先行，
   字段与 server/Drizzle schema 对齐，后端落地后可无缝切换。
   ════════════════════════════════════════════════════════════ */

/** 投递状态机 · 前置阶段（按序推进：备选 → 已投 → 简历被读） */
export const APPLICATION_PREFIX_STAGES = ['backlog', 'applied', 'viewed'] as const
export type ApplicationPrefixStage = (typeof APPLICATION_PREFIX_STAGES)[number]

/** 支持的最大面试轮次（三面/四面/八面… round_1 .. round_8） */
export const MAX_ROUNDS = 8

/** 动态面试轮次阶段（round_1 / round_2 / … 由投递 total_rounds 决定"哪一轮是终面"） */
export type RoundStage = `round_${number}`

/** 投递状态机 · 终态（可随时到达） */
export const APPLICATION_TERMINALS = ['offer', 'rejected', 'withdrawn'] as const
export type ApplicationTerminal = (typeof APPLICATION_TERMINALS)[number]

/** 完整状态（前置 ∪ 动态轮次 ∪ 终态） */
export type ApplicationStatus = ApplicationPrefixStage | RoundStage | ApplicationTerminal

/** 状态元信息：看板列 / 徽章共用，单一来源（round 阶段由 statusMeta() 动态生成） */
export interface ApplicationStatusMeta {
  /** 显示名 */
  label: string
  /** 列头描述 */
  desc: string
  /** 是否终态 */
  terminal: boolean
  /** 徽章文字色类 */
  text: string
  /** 徽章边框/底色类 */
  chip: string
  /** 看板列头圆点色 */
  dot: string
}

/** 固定阶段元信息（前置 + 终态） */
export const APPLICATION_STATUS_META: Record<
  ApplicationPrefixStage | ApplicationTerminal,
  ApplicationStatusMeta
> = {
  backlog: {
    label: '备选',
    desc: '待投递 · 备选池',
    terminal: false,
    text: 'text-[rgba(245,249,254,0.65)]',
    chip: 'border-[rgba(255,255,255,0.14)] bg-[rgba(237,239,242,0.06)]',
    dot: 'bg-[rgba(245,249,254,0.5)]',
  },
  applied: {
    label: '已投',
    desc: '简历已投出',
    terminal: false,
    text: 'text-[#38bdf8]',
    chip: 'border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.08)]',
    dot: 'bg-[#38bdf8]',
  },
  viewed: {
    label: '简历被读',
    desc: 'HR / 系统已读',
    terminal: false,
    text: 'text-[#60f2bd]',
    chip: 'border-[rgba(96,242,189,0.35)] bg-[rgba(96,242,189,0.08)]',
    dot: 'bg-[#60f2bd]',
  },
  offer: {
    label: 'Offer',
    desc: '已发 Offer',
    terminal: true,
    text: 'text-[#32f08c]',
    chip: 'border-[rgba(50,240,140,0.45)] bg-[rgba(50,240,140,0.1)]',
    dot: 'bg-[#32f08c]',
  },
  rejected: {
    label: '拒绝',
    desc: '未通过 / 被拒',
    terminal: true,
    text: 'text-[#f87171]',
    chip: 'border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)]',
    dot: 'bg-[#f87171]',
  },
  withdrawn: {
    label: '放弃',
    desc: '主动放弃',
    terminal: true,
    text: 'text-[rgba(245,249,254,0.45)]',
    chip: 'border-[rgba(255,255,255,0.12)] bg-[rgba(237,239,242,0.04)]',
    dot: 'bg-[rgba(245,249,254,0.3)]',
  },
}

/** 投递方式（决定后续动作：生成简历模板 / 调插件填充 / 邮箱导入） */
export type ApplyMethod = 'official_form' | 'email' | 'ats' | 'other'
export const APPLY_METHODS: ApplyMethod[] = ['official_form', 'email', 'ats', 'other']
export const APPLY_METHOD_LABELS: Record<ApplyMethod, string> = {
  official_form: '官网表单',
  email: '邮箱投递',
  ats: 'ATS 系统',
  other: '其他',
}
export const APPLY_METHOD_DESC: Record<ApplyMethod, string> = {
  official_form: '调浏览器插件自动填充 · 人工确认后提交',
  email: '用招聘邮箱发简历 · 可粘贴邮件自动导入看板',
  ats: '平台内投递（BOSS/猎聘等）· 插件采集岗位',
  other: '内推 / 线下等',
}

/** 投递记录 */
export interface Application {
  id: string
  company: string
  /** 岗位名称 */
  title: string
  /** 投递方式（官网表单 / 邮箱 / ATS / 其他） */
  apply_method?: ApplyMethod
  /** 岗位 URL */
  url?: string
  /** JD 全文（B2 采集 / B3 匹配依据） */
  jd?: string
  /** 渠道（官网 / BOSS 直聘 / 内推…） */
  channel?: string
  status: ApplicationStatus
  tags: string[]
  notes: string
  /** 预期面试总轮数（1–8，决定哪一轮是"终面"；默认 3） */
  total_rounds?: number
  /** 重要性 1–5（看板排序 / 优先级，1 最高） */
  importance?: number
  /** 邮箱往来内容（归档 · 用户粘贴 / 未来接入邮箱） */
  email_thread?: string
  /** 拒绝原因（F1 失败原因分布依据，标记「拒绝」时可选记录） */
  reject_reason?: string
  /** 投递时间（ISO 日期） */
  applied_at?: string
  created_at: string
  updated_at: string
}

/** 创建 / 更新投递载荷 */
export type ApplicationPayload = Omit<Application, 'id' | 'created_at' | 'updated_at'>

/** 状态变更日志（B 状态机 / F1 漏斗依据） */
export interface ApplicationEvent {
  id: string
  application_id: string
  /** null = 首次创建 */
  from: ApplicationStatus | null
  to: ApplicationStatus
  at: string
  note?: string
}

/** 看板分组（按状态） */
export type ApplicationBoard = Record<ApplicationStatus, Application[]>

/** 漏斗 / 渠道 / 时间聚合结果 */
export interface ApplicationStats {
  /** 每个状态当前持有数量 */
  byStatus: Record<ApplicationStatus, number>
  /** 漏斗：每个阶段曾经到达的数量（含终态到达数） */
  funnel: Array<{ status: ApplicationStatus; label: string; count: number }>
  /** 按渠道分布 */
  byChannel: Array<{ channel: string; count: number }>
  /** 按投递月份分布（近 12 月，倒序） */
  byMonth: Array<{ month: string; count: number }>
}

/* ════════════════════════════════════════════════════════════
   面试工具 / 投递归档领域（模块 C/D）类型契约
   ════════════════════════════════════════════════════════════ */

/** 面试工具类型：线上会议 / 线下 / 电话 / 其他 */
export type InterviewToolKind = 'video' | 'onsite' | 'phone' | 'other'

/** 可自定义的面试软件（面试前选择） */
export interface InterviewTool {
  id: string
  name: string
  kind: InterviewToolKind
  /** 打开链接（可选） */
  url?: string
}

/** 投递归档条目：录制 / 附件 / 笔记（"每个投递一个文件夹"的存储模型） */
export interface ArchiveItem {
  id: string
  application_id: string
  /** 关联面试轮次（可选） */
  interview_id?: string
  kind: 'recording' | 'attachment' | 'note'
  title: string
  /** 本地文件引用（文件名，视频等由用户归档到本地文件夹） */
  file_name?: string
  /** 文件大小（字节） */
  file_size?: number
  /** 时长（秒，录制用） */
  duration?: number
  /** 发生日期（ISO 日期） */
  occurred_at: string
  created_at: string
}

/** 创建归档载荷 */
export type ArchivePayload = Omit<ArchiveItem, 'id' | 'created_at'>

/* ════════════════════════════════════════════════════════════
   面试领域（模块 C）类型契约
   ════════════════════════════════════════════════════════════ */

/** 面试形式 */
export type InterviewType = 'phone' | 'video' | 'onsite'
export const INTERVIEW_TYPES: InterviewType[] = ['phone', 'video', 'onsite']
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  phone: '电话',
  video: '视频',
  onsite: '现场',
}

/** 单轮面试结果 */
export type InterviewResult = 'passed' | 'pending' | 'failed'
export const INTERVIEW_RESULTS: InterviewResult[] = ['passed', 'pending', 'failed']
export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  passed: '通过',
  pending: '待定',
  failed: '淘汰',
}

/** 一轮面试中的题目与回答 */
export interface InterviewQA {
  question: string
  answer: string
}

/** 面试轮次（C1）—— 挂在某个投递（application）下 */
export interface Interview {
  id: string
  application_id: string
  /** 轮次序号（第 1 轮 / 第 2 轮…，按投递内自增） */
  round: number
  /** 面试日期（ISO 日期） */
  occurred_at: string
  interview_type: InterviewType
  interviewer?: string
  /** 题目与我的回答（C4 题库沉淀来源） */
  qa: InterviewQA[]
  /** 自评 1–5 */
  self_rating: number
  result: InterviewResult
  notes?: string
  created_at: string
  updated_at: string
}

/** 创建面试载荷（id/时间戳/轮次由 store 生成） */
export type InterviewPayload = Omit<Interview, 'id' | 'round' | 'created_at' | 'updated_at'>

/** 面试复盘（C3）—— 可覆盖一轮或多轮 */
export interface Reflection {
  id: string
  application_id: string
  /** 复盘覆盖的面试 id 列表 */
  interview_ids: string[]
  /** 做得好（可多个） */
  highlights: string[]
  /** 待改进（可多个） */
  improvements: string[]
  /** 下次策略（可多个） */
  next_strategy: string[]
  /** 整段复盘正文（可含题目沉淀） */
  content_md: string
  /** 是否 AI / 本地启发生成 */
  ai_generated: boolean
  created_at: string
  updated_at: string
}

/** 创建复盘载荷 */
export type ReflectionPayload = Omit<Reflection, 'id' | 'created_at' | 'updated_at'>

/** 面经题库条目（C4） */
export interface QuestionBankItem {
  id: string
  question: string
  /** 我的沉淀答案 */
  answer?: string
  /** 方向分类（如 网络安全 / 前端 / 算法） */
  category?: string
  /** 行业（README 行业可插拔：档案/题库/技能均带 industry/category） */
  industry?: string
  /** 难度 1–5 */
  difficulty: number
  tags: string[]
  /** 来源：面试沉淀 / 自建 */
  source: 'interview' | 'manual'
  /** 关联面试 id（可选溯源） */
  interview_id?: string
  created_at: string
  updated_at: string
}

/** 创建题库条目载荷 */
export type QuestionBankPayload = Omit<QuestionBankItem, 'id' | 'created_at' | 'updated_at'>

/* ════════════════════════════════════════════════════════════
   成长闭环领域（模块 F）类型契约
   ════════════════════════════════════════════════════════════ */

/** 学习计划任务（F2） */
export interface LearningTask {
  id: string
  title: string
  done: boolean
  /** 截止日期（ISO 日期） */
  due?: string
}

/** 学习计划（F2）—— 由短板分析 / 复盘生成或手动创建 */
export interface LearningPlan {
  id: string
  title: string
  description?: string
  /** 来源：手动 / 由复盘自动生成 */
  source: 'manual' | 'reflection'
  tasks: LearningTask[]
  created_at: string
  updated_at: string
}

/** 创建学习计划载荷 */
export interface LearningPlanPayload {
  title: string
  description?: string
  source: LearningPlan['source']
  tasks: LearningTask[]
}

/** 技能水平快照（F3）：某时刻对某技能的熟练度自评 1–5 */
export interface SkillSnapshot {
  id: string
  skill: string
  level: number
  /** ISO 日期 */
  recorded_at: string
  note?: string
}

/** 创建技能快照载荷 */
export type SkillSnapshotPayload = Omit<SkillSnapshot, 'id'>

/* ════════════════════════════════════════════════════════════
   AI 配置领域（模块 E1）类型契约
   ════════════════════════════════════════════════════════════ */

/** AI 来源：云端（DeepSeek 兼容网关，默认） / 本地（Ollama） */
export type AIProvider = 'cloud' | 'local'

/** AI Provider 配置（E1 双模式） */
export interface AIConfig {
  provider: AIProvider
  /** 云端 Anthropic 兼容网关 Endpoint */
  cloudEndpoint: string
  cloudModel: string
  /** API Key（本地优先自存 localStorage；后端落地后改加密存储 / 代理） */
  cloudApiKey: string
  /** 本地 Ollama Endpoint（/v1 兼容） */
  localEndpoint: string
  localModel: string
  /** E3：是否已授权云端数据出境 */
  dataExitConsented: boolean
  /** E3：全局「仅用本地模型」开关 */
  localOnly: boolean
}

/** 默认 AI 配置 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'cloud',
  cloudEndpoint: 'https://api.deepseek.com',
  cloudModel: 'deepseek-chat',
  cloudApiKey: '',
  localEndpoint: 'http://localhost:11434/v1',
  localModel: 'qwen2.5:7b',
  dataExitConsented: false,
  localOnly: false,
}

/* ════════════════════════════════════════════════════════════
   自动投递领域（模块 D）类型契约 —— 前端侧 UI/映射记忆
   ════════════════════════════════════════════════════════════ */

/** 档案字段（D4 字段映射的可映射目标，含 D6 简历附件） */
export type AutomationTargetField =
  | 'full_name'
  | 'email'
  | 'phone'
  | 'headline'
  | 'summary'
  | 'resume'
export const AUTOMATION_TARGET_FIELDS: AutomationTargetField[] = [
  'full_name',
  'email',
  'phone',
  'headline',
  'summary',
  'resume',
]
export const AUTOMATION_TARGET_LABELS: Record<AutomationTargetField, string> = {
  full_name: '姓名',
  email: '邮箱',
  phone: '电话',
  headline: '头衔',
  summary: '个人简介',
  resume: '简历附件',
}

/** 表单控件类型（D3 扫描的四类控件） */
export type AutomationControlType = 'input' | 'select' | 'textarea' | 'file'
export const AUTOMATION_CONTROL_TYPES: AutomationControlType[] = [
  'input',
  'select',
  'textarea',
  'file',
]

/** 站点表单字段映射（D4）：记录某站点的控件 → 档案字段，跨会话复用 */
export interface FormMapping {
  id: string
  /** 站点 origin（如 https://jobs.example.com） */
  origin: string
  /** 表单控件 name / id（启发式识别或用户手动指定） */
  field_key: string
  field_label?: string
  /** 控件类型（D3） */
  control_type?: AutomationControlType
  /** 映射到的档案字段 */
  target_field: AutomationTargetField
  updated_at: string
}

/** 创建映射载荷 */
export type FormMappingPayload = Omit<FormMapping, 'id' | 'updated_at'>




