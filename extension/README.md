# Profession-Archives 浏览器插件（MV3）

连接本地档案与官网投递表单的浏览器插件骨架。

## 当前状态

**骨架**：目录结构、manifest（wxt）、background / content / popup 已就位，标注了 `TODO` 的核心逻辑待正式开发。

## 规划功能（对应 README 模块 D）

| 功能 | 说明 |
|---|---|
| **岗位采集** | 岗位详情页点插件，提取 公司/岗位/JD/URL/页面快照 → 回传本地桥 → 看板建记录 |
| **表单自动填充** | 官网投递页点插件，读取本地档案 → 按字段映射填充姓名/邮箱/电话/简历附件 → **人工确认后提交** |
| **字段映射记忆** | per-origin 映射规则（识别不准时手动指定并记住） |
| **投递回传** | 提交成功后自动回传看板"已投" |
| **合规硬约束** | 不破验证码、不绕过登录、不做反爬对抗；一切提交需用户主动确认 |

## 本地桥（依赖桌面端服务端）

插件通过 `http://127.0.0.1:8000/api/automation/*` 与桌面端通信：
- 配对：桌面端生成配对码，插件 popup 粘贴，请求带 `Authorization: Bearer <token>`
- CORS 白名单仅放行扩展 origin；服务端只绑 127.0.0.1

## 开发

```bash
npm install
npm run dev      # wxt dev（热更新）
npm run build    # 构建到 .output/chrome-mv3
```

## 加载到浏览器测试

1. `npm run build` 生成 `.output/chrome-mv3/`
2. Chrome / Edge 打开 `chrome://extensions`（Edge 用 `edge://extensions`）
3. 开启"开发者模式" → "加载已解压的扩展程序" → 选择 `.output/chrome-mv3/`
4. 先启动桌面端本地服务（`PA_PAIRING_TOKEN=xxx npx tsx server/src/index.ts`），在 popup 粘贴配对码
5. 打开 `tests/demo-submit-form.html`（模拟官网投递表单）→ 点 popup「填充投递表单」→ 人工核对后提交

## 验证状态

- ✅ wxt 构建通过（`.output/chrome-mv3/`）
- ✅ content 表单扫描/填充/高亮、岗位采集、投递回传、desktopCapture 系统音频 已实现
- ⚠️ 真实官网动态表单（React/Vue）识别为 TODO，需逐站适配
