# Profession-Archives

![logo](logo.png)

## 产品目标

- 全面的简历管理，本地化更隐私。
- 针对目标岗位快速特化简历，筛选重点表达。
- 面向多平台投递场景，减少重复翻资料（后续接浏览器插件智能填充）。
- 记录从投递到面试的全流程，便于复盘优化。
- 引入 AI 润色，最喜欢vibe-coding了

## 架构

- **Desktop**: PyWebView（原生应用窗口）
- **Backend**: FastAPI（本地服务）
- **Database**: SQLite（本地持久化）
- **Frontend**: Vue 3 + Vite + daisyUI（静态资源）
- **Packaging**: PyInstaller（单文件 exe）

说明：项目默认走单机一体化链路，不依赖云端部署。

## 功能边界

### 一期（已落地主线）

- 职业档案原子化管理（个人信息、技能、教育、项目、经历）
- 岗位投递看板（状态流转与过程追踪）
- JD 关键词匹配与简历草稿生成

### 二期（规划）

- 浏览器插件自动填充
- 多平台投递模板适配
- 更细粒度 AI 润色策略

## 运行

下载release，即可启动应用。

## 最小目录结构

```text
Profession-Archives/
├── backend/                 # FastAPI 服务与业务逻辑
├── frontend/                # Vue 前端源码
├── dev-tools/               # 可选：构建脚本与工程产物（非必需）
└── README.md                # 说明文档
```
