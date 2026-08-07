# Profession-Archives 架构与开发计划

> 本文件是全新架构的技术蓝图与分阶段开发计划（**推翻现有 demo，TypeScript 全栈重写**）。
> 需求基线见 [README.md](../README.md)（完整 PRD）；商业化见 [docs/business-model.md](business-model.md)。
> 现状：原仓库是一版 Python demo（FastAPI + sqlite3 + PyWebView + Vue3 + Tauri 2.2 脚手架），按用户决策**彻底清除**（demo 代码与 git 历史均已删除，仓库全新初始化，2026-08-06），以下为全新 TS 架构的完整设计。

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

**环境实测**：Node v24.18.0 / npm 11.16.0 就绪；**Rust/Cargo 未安装**（Tauri 构建必需，列为阶段 0 前置）。

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
├── src-tauri/                # Rust crate：窗口/托盘/系统能力 + sidecar spawn
│   ├── tauri.conf.json
│   ├── binaries/             # sidecar 构建产物
│   └── src/lib.rs            # setup 钩子 spawn Node 后端；on_window_event kill sidecar
├── cloud/                    # @pa/cloud：云端接口桩（名片托管/AI 网关/链上存证，后置实现）
├── tests/                    # vitest 集成测试
└── .github/workflows/ci.yml
```

---

## 4. 核心架构设计

### 4.1 运行形态（Tauri 壳 + Node sidecar）

- Tauri 启动时通过 `tauri::process::Command::new_sidecar` spawn Node 后端。
- 开发模式：`node --import tsx server/src/index.ts`；生产模式：`bun build --compile` 单文件 sidecar（Tauri `externalBin` 注册，命名需带 target triple，如 `server-x86_64-pc-windows-msvc.exe`）。
- 前端直接 `fetch("http://127.0.0.1:{port}")` 访问 Node 后端，**不需要** tauri-plugin-http 中间层。
- 生命周期：`on_window_event(CloseRequested)` 显式 kill sidecar，防进程泄漏。
- ⚠️ 验证点：bun compile 对 better-sqlite3 native addon（`.node`）的打包；失败降级 ncc + portable Node。

### 4.2 浏览器插件通信（本地桥）

```
浏览器插件(MV3) ◄─ 127.0.0.1:{port}/api/automation/* ─► Node 后端(Fastify) ─► SQLite
```

- **端口**：首次启动随机选空闲端口，写入 app config 持久化。
- **配对 token**：启动时生成 `crypto.randomUUID()`，设置页展示，插件 popup 粘贴，存 `chrome.storage.local`；请求带 `Authorization: Bearer <token>`。
- **CORS**：`@fastify/cors` 仅放行 `chrome-extension://<extension-id>`。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/automation/profile` | 插件读取当前档案（供填充） |
| POST | `/api/automation/job` | 插件采集岗位回传入库 |
| POST | `/api/automation/application` | 投递结果回传（更新状态） |
| POST | `/api/automation/form-mapping` | 上报站点字段映射（跨会话复用） |
| GET | `/api/automation/form-mapping?origin=` | 查询站点已记忆映射 |

### 4.3 AI Provider 抽象

- `server/src/ai/provider.ts` 提供 `AIConfig → LanguageModel` 工厂：DeepSeek（`@ai-sdk/openai` 配 baseURL）、Ollama（本地 `:11434/v1`）、预留 Anthropic。
- `prompts/` 按能力分文件：`extract`（素材提炼）、`polish`（简历润色）、`match`（JD 语义匹配）、`reflect`（面试复盘）、`learn`（短板分析/学习计划）。
- 配置存 `ai_provider_config` 表；未配置时首次启动引导。E3 隐私授权（云端调用提示 + 全局"仅本地模型"开关）在 AI 层强制接入。

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

### 4.6 旧代码处置（已完成）

- 原 demo（Python FastAPI 后端、Vue 前端、Tauri 2.2 脚手架、旧 SQLite 数据）与全部 git 历史已按用户决策**彻底删除**，仓库全新初始化（2026-08-06）。
- 原前端资产（设计令牌等）不再保留：新前端 design system 从零构建，以 Tailwind v4 + daisyUI 主题为主。
- 原 API 类型契约、数据 schema 思路仅作为本架构文档与 README 的需求参考，不复用 demo 代码。

---

## 5. 分阶段开发计划

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
