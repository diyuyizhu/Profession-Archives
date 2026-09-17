# Profession-Archives 架构与开发计划

> 本文件是全新架构的技术蓝图与分阶段开发计划（**推翻现有 demo，TypeScript 全栈重写**）。
> 需求基线见 [README.md](../README.md)（完整 PRD）；商业化见 [docs/business-model.md](business-model.md)。
> 现状：原仓库是一版 Python demo（FastAPI + sqlite3 + PyWebView + Vue3 + Tauri 2.2 脚手架），按用户决策**彻底清除**（demo 代码与 git 历史均已删除，仓库全新初始化，2026-08-06），以下为全新 TS 架构的完整设计。

> ⚠️ **实现偏差说明（2026-09 复核，以本节为准）**
>
> 本文件写于阶段 0 之前，落地过程中有几处**已按实现调整**，读后续章节时请对照：
>
> | 蓝图 | 实际实现 | 说明 |
> |---|---|---|
> | Tauri spawn **Node sidecar** | **桥内置于 Rust**（`src-tauri/src/bridge.rs`，`tiny_http` 绑 `127.0.0.1:8000`） | `tauri.conf.json` 无 `externalBin`，`lib.rs` 不 spawn Node；AI 调用在 `src-tauri/src/ai.rs`，文件解析在 `src-tauri/src/import.rs` |
> | `better-sqlite3 + Drizzle ORM` + drizzle-kit 迁移 | 裸 `better-sqlite3` + 手写 `ensureColumn` 补列（`server/src/db.ts`） | 未接入 Drizzle；`server/` 桌面端不启动，见 [server/README.md](../server/README.md) |
> | `Vercel AI SDK` | 自研 HTTP 客户端（Rust `ureq` / Node `fetch`）调 OpenAI 兼容接口 | 未引入 AI SDK |
> | `Zod v4` 校验 | 前端 TS 类型 + 后端手写校验 | 未引入 Zod |
> | `undici + cheerio` URL 采集 | 岗位采集以**插件**为主（`extension/entrypoints/content.ts`） | 未引入无头/静态抓取依赖 |
> | `vitest + ESLint + CI` | `tests/smoke.ts`（自写断言）+ `cargo test` | 无 vitest/ESLint/CI 配置 |
> | 前端数据存 SQLite | **localStorage 为事实源**（17 个 store、13 个 `pa-*-v1` key） | SQLite 仅 `server/` 独立运行时使用 |
> | `cloud/` 目录 | 未创建 | 云端接口仍为纸面契约 |
>
> **文档其余部分保留为原始设计意图**，未逐条改写；涉及「Node sidecar / Drizzle / vitest」的表述按上表理解。

---

## 1. 背景与产品决策

**已确认决策（不可更改）**：

| 决策点 | 结论 |
|---|---|
| 桌面形态 | **Tauri 2 桌面应用**（Rust 壳承载窗口/托盘/系统能力） |
| 后端 | **TypeScript / Node**（与前端 Vue(TS) 同语言）：业务逻辑、AI 服务、插件本地桥、URL 采集全在 Node 后端 |
| 计划深度 | 完整路线图：架构搭建 + M1–M5 全阶段 |
| 云端 | 预留接口（名片托管/AI 网关/链上存证），本地核心先行 |
| 旧代码 | **彻底删除**（demo 代码与 git 历史均清除），仓库从零初始化、全新起点 |
| 开发方式 | 单人开发（vibe coding），按阶段独立交付验收 |

**环境实测**：Node v24.18.0 / npm 11.16.0 就绪；Rust 1.97.1 + Cargo 已装（2026-09 复核，阶段 0 前置已满足，`release/` 已有 v0.2.0 构建产物）。

---

## 2. 技术选型

| 层 | 选型 | 理由要点 |
|---|---|---|
| Monorepo | **npm workspaces**（shared/server/frontend/cloud） | 环境已验证，规模够用，Tauri 侧无幽灵依赖隐患 |
| 后端框架 | **Fastify v5** | 性能高、插件体系适合模块化、原生 JSON Schema |
| 数据库 | **better-sqlite3 + Drizzle ORM** | 同步 API、TS-first、`drizzle-kit` 迁移（解决 demo 无 ORM/无迁移硬伤） |
| 数据校验 | **Zod v4** | Pydantic 语义等价替代，`z.toJSONSchema()` 对接 Fastify |
| AI 抽象 | **Vercel AI SDK**（@ai-sdk/openai 驱动 DeepSeek/Ollama，预留 anthropic） | 统一 streaming/tool/prompt，模型切换走配置 |
| URL 采集 | **undici + cheerio** | 轻量；动态站点靠插件采集，不引入无头浏览器 |
| 本地桥 | Node 后端内起 `127.0.0.1:{port}` Fastify 服务 | 配对 token + CORS 白名单 |
| Tauri 集成 | **sidecar spawn Node 后端**（开发 tsx；生产 bun build --compile 单文件，备选 ncc+portable Node） | ⚠️ bun×better-sqlite3 native addon 兼容需阶段 0 验证 |
| 浏览器插件 | **wxt**（MV3 + TS） | 自动管理 manifest/content/popup/background |
| 前端 | Vue3 + Vite6 + Tailwind v4 + daisyUI + Pinia + Vue Router | design system **从零构建**（Tailwind v4 + daisyUI 主题，参考 README 产品风格） |
| 测试/质量 | vitest + ESLint(@antfu) + Prettier + GitHub Actions CI | CI 暂不跑 Tauri build（需 Windows+Rust，本地构建） |

---

## 3. 目标目录结构（全新仓库布局）

```
Profession-Archives/
├── package.json              # npm workspaces: shared, server, frontend, cloud
├── tsconfig.base.json / eslint.config.js / .prettierrc
├── shared/                   # @pa/shared：TS 类型 + Zod schema + 常量（前后端共享契约）
├── server/                   # @pa/server：Fastify 业务
│   ├── drizzle/              # drizzle-kit 迁移文件
│   └── src/
│       ├── index.ts          # 启动入口
│       ├── app.ts            # Fastify app 工厂（插件注册、路由挂载）
│       ├── env.ts            # 环境变量 + app 路径解析
│       ├── db/               # better-sqlite3 + Drizzle 连接与 schema 定义
│       ├── plugins/          # cors / auth(配对 token) / swagger
│       ├── routes/           # health / profile / journal / application / interview / ai / automation / resume / analytics / export
│       ├── services/         # 业务逻辑
│       ├── ai/               # Provider 抽象 + prompts/（extract/polish/match/reflect/learn）
│       ├── scrapper/         # URL 采集（undici + cheerio）
│       └── utils/            # crypto(token/加密)、fs
├── frontend/                 # @pa/frontend：Vue3 SPA
│   └── src/
│       ├── router/           # Vue Router（/,/archive,/tracking,/profile,/interview,/analytics,/ai-config,/card-preview,/settings）
│       ├── stores/           # Pinia（profile/application/ai-config/ui）
│       ├── composables/      # useApi / useAI / useTheme
│       ├── views/            # Home / ArchiveEntry / ProfileManager / TrackingBoard / Interview / Analytics / AIConfig / CardPreview / Settings
│       └── components/       # common / profile / application / interview / ai
├── extension/                # 独立 wxt 项目（不入 workspace）：MV3 插件
│   └── entrypoints/          # popup(Vue) / content(表单扫描+填充) / background(消息路由)
├── src-tauri/                # Rust crate：窗口/录制 + 内置本地桥
│   ├── tauri.conf.json
│   ├── binaries/             # （空；无 sidecar，见 4.1 偏差说明）
│   └── src/                  # lib.rs（窗口/录制）+ bridge.rs（桥）+ ai.rs + import.rs
├── cloud/                    # @pa/cloud：云端接口桩（名片托管/AI 网关/链上存证，后置实现）
├── tests/                    # 冒烟测试（smoke.ts；未用 vitest）
└── .github/workflows/ci.yml  # （未创建）
```

---

## 4. 核心架构设计

### 4.1 运行形态（Tauri 壳 + Node sidecar）

> ⚠️ **已改为「Tauri 壳 + Rust 内置桥」**：本节保留原始 sidecar 方案作为备选，
> 实际实现见 `src-tauri/src/bridge.rs`（`tiny_http` 绑 `127.0.0.1:8000`）。
> 取舍原因：Node sidecar 需处理 bun×better-sqlite3 打包、进程泄漏、端口协商与跨平台分发；
> Rust 桥随进程启动即在线、零外部运行时依赖，插件与前端所需接口用 Rust 重写成本可控。
> 代价：能力需双实现（`server/src/routes/import-text.ts` ↔ `src-tauri/src/import.rs`），
> 且 `server/` 沦为开发/备用（见 [server/README.md](../server/README.md)）。

- Tauri 启动时通过 `tauri::process::Command::new_sidecar` spawn Node 后端。
- 开发模式：`node --import tsx server/src/index.ts`；生产模式：`bun build --compile` 单文件 sidecar（Tauri `externalBin` 注册，命名需带 target triple，如 `server-x86_64-pc-windows-msvc.exe`）。
- 前端直接 `fetch("http://127.0.0.1:{port}")` 访问 Node 后端，**不需要** tauri-plugin-http 中间层。
- 生命周期：`on_window_event(CloseRequested)` 显式 kill sidecar，防进程泄漏。
- ⚠️ 验证点：bun compile 对 better-sqlite3 native addon（`.node`）的打包；失败降级 ncc + portable Node。

### 4.2 浏览器插件通信（本地桥）

```
浏览器插件(MV3) ◄─ 127.0.0.1:8000/api/automation/* ─► Rust 内置桥(bridge.rs) ─► bridge-store.json
```

- **端口**：固定 `127.0.0.1:8000`（未做随机端口协商；与 `server/` 手动启动会冲突）。
- **配对 token**：启动时生成并落盘 `bridge-store.json`，设置页展示，插件 popup 粘贴，存 `chrome.storage.local`；请求带 `Authorization: Bearer <token>`。
- **CORS**：手写白名单回显 origin（Tauri webview / `localhost` / `127.0.0.1` / `chrome-extension://`），拒绝的 origin 不设 ACAO。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/health` | 桥在线探测（无需配对） |
| GET | `/api/bridge/token` | 前端取配对码（仅回环来源） |
| GET | `/api/automation/profile` | 插件读取当前档案（供填充） |
| POST | `/api/automation/job` | 插件采集岗位回传入库 |
| POST | `/api/automation/application` | 投递结果回传（更新状态） |
| POST/GET | `/api/automation/form-mapping` | 站点字段映射上报 / 按 origin 查询 |
| POST | `/api/bridge/sync` | 前端同步 aiConfig + 档案摘要给桥 |
| GET/POST | `/api/bridge/inbox` · `/api/bridge/inbox/clear` | 前端拉取 / 清空采集 inbox |
| POST | `/api/automation/ai/{analyze-fields,extract-job,generate-resume,parse-resume}` | 桥内 AI 调用 |
| POST | `/api/import/extract-text` | PDF / DOCX → 文本（`src-tauri/src/import.rs`） |

### 4.3 AI Provider 抽象

- 实现位置：**桌面端在 Rust 桥内**（`src-tauri/src/ai.rs`，ureq 直连 OpenAI 兼容接口），
  `server/src/services/aiService.ts` 是同逻辑的 Node 版（开发/备用）。
- Prompt 按能力内联在 `ai.rs::prompt_of`：`AnalyzeFields`（表单字段识别）、`ExtractJob`（岗位提取）、
  `ParseResume`（简历解析）、`GenerateResume`（特化简历）、`Ping`（连通性自检）。
- 配置：前端 `pa-ai-config-v1`（localStorage）为源，启动与保存时经 `POST /api/bridge/sync` 同步到桥侧
  `ai-config.json`；未配置时 AI 调用返回明确原因。E3 隐私授权（云端需 `dataExitConsented`、
  全局 `localOnly` 强制本地）在 AI 层强制接入。
- 自检：`POST /api/automation/ai/ping` + 设置页「测试连接」——真正打一次模型，把配置问题当场暴露。

#### 4.3.1 云端参数对齐 DeepSeek 官方文档

> 依据 <https://api-docs.deepseek.com/zh-cn/>（2026 复核）。改 AI 相关代码前先核对这节。

| 项 | 官方规定 | 本项目取值 |
|---|---|---|
| base_url（OpenAI 格式） | `https://api.deepseek.com` | 默认 Endpoint；程序自动拼 `/chat/completions` |
| 模型名 | `deepseek-flash`(V4.1-Flash) / `deepseek-v4-pro` | 默认 `deepseek-flash`；设置页给预设按钮 + 非法名提示 |
| 旧模型名 | `deepseek-chat` / `deepseek-reasoner` 已不在现行文档 | 仅作为「已下线」提示文案出现 |
| 思考模式 | **默认开启**，`thinking.type` = enabled/disabled，`reasoning_effort` = none/low/high/max（默认 high） | JSON 类任务显式 `disabled`（要确定性 + 低延迟）；简历生成 `enabled` + effort `low` |
| 思考模式下的 temperature | **不生效**（不报错）；top_p 下限被抬到 0.95 | 仅在非思考路径依赖 temperature（JSON 任务 0.1） |
| `max_tokens` | 1 ~ 384K；不设时非思考默认 8K、思考默认 64K | JSON 8192；文本 16384（并检测 `finish_reason=length` 报截断） |
| JSON Output | `response_format={"type":"json_object"}`，**prompt 必须含 json 字样**，可能偶发空 content | JSON 任务启用；各 prompt 均含「输出 JSON」 |
| 错误码 | 400 格式 / 401 认证 / 402 余额 / 422 参数 / 429 限速 / 500·503 服务端 | `status_hint()` 逐码给可操作提示；并把 API 错误正文透出 |
| 请求保活 | 非流式会持续返回空行；服务端 10 分钟未开始推理才断连 | 客户端超时给足余量：JSON 120s / 文本 180s |
| 并发限制 | flash 2500 / v4-pro 500（账号级） | 本地单人使用不触及 |

**为什么 JSON 任务关掉思考模式**：思维链对结构化抽取没有收益，却会把延迟和费用放大数倍，
且 `temperature` 失效导致输出稳定性下降；简历解析失败最常见的两个现象
（「超时」与「返回不是合法 JSON」）都直接源于此。

### 4.4 云端预留接口（cloud/，后置实现）

```ts
// 名片托管（第一付费点）
POST   /api/cloud/card/publish      // 上传名片 HTML → 稳定 URL
GET    /api/cloud/card/:id
// AI 网关（第二付费点）
POST   /api/cloud/ai/proxy          // 代理 AI 请求（计费+日志）
GET    /api/cloud/ai/usage
// 链上存证（第三付费点）
POST   /api/cloud/chain/attest      // 提交哈希上链
GET    /api/cloud/chain/verify/:hash
```

- `@pa/shared` 定义云端契约类型；`PA_CLOUD_ENABLED` 开关（默认 false）；本地 mock 数据。
- 实现优先级：M1–M5 交付后（约 3–4 周）。

### 4.5 数据模型（Drizzle schema 概要）

核心表（`*` 沿用 demo 思路，`+` 新增；**所有分类表自第一天带 `industry`/`category` 字段**，支撑多行业扩展）：

| 表 | 职责 | 备注 |
|---|---|---|
| `profiles` * | 档案主表 | full_name/headline/email/phone/summary |
| `skills` * | 技能 | + `level`(1-5 自评) |
| `experiences` * | 工作经历 | + industry/category |
| `education` * | 教育背景 | |
| `projects` * | 项目经历 | + industry/category |
| `journal_entries` + | 日记/成就/里程碑（A1） | entry_type/title/content_md/occurred_at |
| `certificates` + | 证书/资质（扩展方向） | issuing_body/cert_number/expiry_date/blockchain_tx(预留) |
| `applications` * | 投递记录 | + 完整状态机 |
| `application_events` + | 状态变更日志 | from/to/at（与 `@pa/shared` ApplicationEvent 契约一致，server 落地时按此建列） |
| `interviews` + | 面试轮次（C1） | interview_type/qa(JSON 数组 `[{question,answer}]`)/self_rating/result（与 `@pa/shared` Interview 契约一致） |
| `reflections` + | 面试复盘（C3） | content_md/ai_generated |
| `question_bank` + | 面经题库（C4） | question/category/difficulty/industry |
| `learning_plans` + `learning_tasks` + | 学习计划（F2/F3） | |
| `form_mappings` + | 站点表单字段映射（D4） | origin/field_key/selector_pattern |
| `ai_provider_config` + | AI 配置（E1） | provider/endpoint/api_key_encrypted/model_name |
| `resume_versions` * / `assets` * | 简历版本 / 附件 | |

**原则**：tags 用规范化关联表（`tags` + 多对多）而非 JSON 字符串；时间统一 ISO 8601 TEXT；数据库落 `%APPDATA%/ProfessionArchives/profession-archives.sqlite3`，开启 WAL + foreign_keys。

> ⚠️ **实际 schema 与上表的差异（以 `server/src/db.ts` 为准）**：
>
> - **已建表（11 张）**：`profiles` / `skills` / `experiences` / `education` / `projects` / `journal_entries` / `applications` / `application_events` / `form_mappings` / `ai_provider_config` / `attestations`（存证哈希，上表未列）。
> - **未建表**：`certificates`、`interviews`、`reflections`、`question_bank`、`learning_plans`、`learning_tasks`、`resume_versions`、`assets`、`tags` —— 这些模块的**数据目前存在前端 localStorage**（如 `pa-interview-tools-v1`、`pa-question-bank-v1`、`pa-learning-plans-v1`、`pa-resume-tree-v1`）。
> - **tags 未规范化**：各表用 `tags_json TEXT DEFAULT '[]'`，未建 `tags` 关联表。
> - **industry / category 未落地**：`skills` 只有 `category`，`experiences` / `projects` 未建 `industry` / `category` 列 —— 多行业扩展前需补。
> - **迁移方式**：无 drizzle-kit，用 `ensureColumn()` 查 `PRAGMA table_info` 后 `ALTER TABLE ADD COLUMN`。

### 4.6 旧代码处置（已完成）

- 原 demo（Python FastAPI 后端、Vue 前端、Tauri 2.2 脚手架、旧 SQLite 数据）与全部 git 历史已按用户决策**彻底删除**，仓库全新初始化（2026-08-06）。
- 原前端资产（设计令牌等）不再保留：新前端 design system 从零构建，以 Tailwind v4 + daisyUI 主题为主。
- 原 API 类型契约、数据 schema 思路仅作为本架构文档与 README 的需求参考，不复用 demo 代码。

---

## 5. 分阶段开发计划

> **完成度速览（2026-09）**：阶段 0–5 的**功能面**均已落地并出 v0.2.0 产物（`release/`），
> 但落地方式与本节描述有出入（见文首偏差表）。主要缺口：
> ① 数据主存储仍是 localStorage 而非 SQLite；② 无 vitest/ESLint/CI；
> ③ 部分表（interviews / question_bank / learning_plans / resume_versions）未建；
> ④ 插件动态表单（MutationObserver）与权限收窄未完成；⑤ cloud/ 未创建。

### 阶段 0：环境与脚手架（3–5 天）

- 安装 **Rust**（rustup stable-x86_64-pc-windows-msvc）+ **bun**（sidecar 编译）+ **Tauri CLI**。
- monorepo 骨架、`shared/` 最小类型、`server/`（Fastify+SQLite 跑通 `/health`）、`frontend/`（Vite+Vue+Tailwind v4+daisyUI，design system 从零构建）、`src-tauri/` 壳 spawn sidecar、ESLint/Prettier/vitest/CI。
- **验收**：`cargo tauri dev` 打开窗口显示 Vue 首页；前端 proxy 调通后端 `/health`；SQLite 落在 `%APPDATA%/ProfessionArchives/`；`lint/typecheck/test` 通过。
- ⚠️ 验证 **bun compile×better-sqlite3**，失败降级 ncc+portable Node。

### 阶段 1：档案领域 + AI Provider 抽象（5–7 天）

- Drizzle schema 全量（含 journal/certificates/规范化 tags，全部带 industry/category），生成并跑迁移。
- `shared/` 类型扩充；档案 CRUD（含子表嵌套）；日记/成就/里程碑 CRUD；聚合名片 API；**AI Provider 抽象层**。
- 前端：Profile 管理页 + 日记录入 UI 重构（Pinia + Zod）。
- **验收**：能建完整档案并在聚合视图看到；配置 DeepSeek Key 后后端调用成功；迁移在空库跑通。

### 阶段 2：AI 能力（5–7 天）

- AI 配置 UI + E3 隐私授权；素材提炼（A3，日记→成就，流式）；简历润色（B3）；**JD 语义匹配**（替换 demo 关键词打分）；简历生成整合 + PDF 导出（jsPDF）；Ollama 本地模式验证。
- **验收**：三 provider 可切换生效；3 条日记提炼成 1 条成就；粘贴真实 JD 得评分+建议；PDF 可导出。

### 阶段 3：面试流程（5–7 天）

- interviews/reflections/question_bank/application_events 表；**投递状态机**（备选→已投→简历被读→一面→二面→终面→Offer/拒绝/放弃）+ 变更日志；kanban 看板重构；面试记录 CRUD；**AI 复盘**；面经题库；转化漏斗 + 失败原因图表（echarts/chart.js）。
- **验收**：投递完整流转看板实时更新；录一场面试 AI 产出复盘；漏斗图数据正确。

### 阶段 4：自动化投递 ★（10–14 天，最高风险）

- 本地桥 5 端点 + 配对 token + CORS；前端配对 UI。
- wxt 插件：popup（配对+状态）、content script 表单扫描、字段映射引擎（内置中英文规则表 + 用户修正 + 按 origin 记忆）、填充+高亮+人工确认、岗位采集、投递回传。
- **验收（即 README D 验收）**：招聘页采集岗位入库；官网表单常见字段自动填充、人工确认提交成功；同站复用映射；提交后看板状态自动更新。
- 风险缓解：MVP 只承诺常见静态/SSR 表单；动态页面 MutationObserver 等待 + 手动指定兜底；`chrome.runtime.connect` 保活；Tauri kill sidecar。

### 阶段 5：成长闭环 + 名片（5–7 天）

- AI 短板分析（learn prompt）→ 一键生成学习计划；技能 level 追踪 + 雷达图；**A5 对外名片页**（聚合渲染 + 导出静态 HTML 供托管）；数据一键导出 JSON/Markdown；收尾集成测试。
- **验收**：漏斗+短板分析→AI 报告→生成学习计划；名片页可预览可导出；导出/导入完整恢复。

### 云端预留（后置）

M1–M5 交付后再启动 cloud 实际开发（约 3–4 周），本计划仅定义接口契约。

---

## 6. 风险与依赖

| 风险 | 概率 | 缓解 |
|---|---|---|
| Rust 未装 / Tauri 2 环境 | 低 | 阶段 0 严格按官方 Windows 前置清单 |
| bun compile × better-sqlite3 | 中 | 阶段 0 验证；降级 ncc/portable Node |
| sidecar 进程泄漏 | 中 | on_window_event kill + RunEvent::Exit 兜底 |
| MV3 SW 休眠断连 | 中 | chrome.runtime.connect 长连接保活 |
| 动态页面表单识别失败 | 高 | MutationObserver + 手动指定字段兜底；MVP 只承诺常见表单 |
| AI 隐私授权遗漏 | 中 | AI 层强制接入全局开关 + 首次弹窗 |

**依赖链**：环境 → 阶段 0 骨架 → 阶段 1（档案+AI 抽象）→ 阶段 2（AI）与阶段 3（面试）→ 阶段 4（自动化投递）→ 阶段 5（成长+名片）→ cloud。阶段 2/3 在 AI 抽象就绪后可部分并行，单人建议顺序执行。

**工作量（单人全职）**：阶段 0: 3–5d / 1: 5–7d / 2: 5–7d / 3: 5–7d / 4: 10–14d / 5: 5–7d → **总计约 33–47 天（7–10 周）**。

---

## 7. 验证策略

1. 每阶段独立验收标准，完成后进入下一阶段。
2. 关键路径端到端：`cargo tauri dev` → 窗口内完成"建档案 → 生成简历 → 录面试 → 看板流转"。
3. 阶段 4 插件全流程用真实招聘网站表单验证（采集→填充→确认→回传）。
4. vitest：每阶段收尾写 3–5 个核心 API 集成测试，保关键路径。
