# `@pa/server` —— Node/Fastify 后端（**开发/备用，桌面端不启动**）

> 状态说明（2026-09）：本目录**不是打包版运行时的一部分**。保留它是为了独立调试 Node 侧逻辑与作为能力参考。

## 为什么桌面端不启动它

架构文档 `docs/architecture.md` 最初规划「Tauri spawn Node sidecar」，实际实现已改为**桥内置于 Rust**：

| 位置 | 说明 |
|---|---|
| `src-tauri/src/bridge.rs` | Tauri 进程内的 HTTP 桥，`tiny_http` 监听 `127.0.0.1:8000`，插件配对 / 采集 / 回传 / 表单映射 |
| `src-tauri/src/ai.rs` | 桥内的 AI 调用（DeepSeek / Ollama，含 SSRF 与隐私授权防护） |
| `src-tauri/src/import.rs` | 档案导入的 PDF / DOCX → 文本提取 |
| `src-tauri/tauri.conf.json` | **没有 `externalBin`**，`lib.rs` 也不 spawn Node 进程 |

因此打包版里 `127.0.0.1:8000` 由 Rust 桥独占；若同时手动跑本服务会**端口冲突**。

## 与本目录的重叠与差异

- 路由能力（`/api/automation/*`、`/api/ai/*`、`/api/import/extract-text`、档案 CRUD）在 Rust 桥里均有对应实现。
- 本目录独有价值：better-sqlite3 直连 SQLite 的档案 CRUD（`src/db.ts` / `src/profile.ts`）—— 前端目前以 localStorage 为事实源，未接入。
- **改动需双写**：`server/src/routes/import-text.ts` 与 `src-tauri/src/import.rs` 是同一能力的两个实现，改一处要同步另一处。

## 怎么跑

```bash
npm run server            # 等价于 npm run dev -w server（tsx watch src/index.ts）
PA_PORT=8010 npm run server   # 换个端口，避免与桌面端桥冲突
```

数据库落 `PA_DATA_DIR`（默认 `<repo>/.pa-data/profession-archives.sqlite3`）。

## 后续处置（未定）

二选一，等产品侧决定：

1. **删除**：把仍有价值的能力（如 SQLite 档案 CRUD）并入 Rust 桥，本目录整体移除；
2. **接回 sidecar**：在 `tauri.conf.json` 补 `externalBin` + 进程生命周期管理，让 Node 成为真正的后端。

在此之前请勿把本目录当作「桌面端后端」来阅读或改动。
