# 桌面端外部二进制（sidecar）

系统级录制（屏幕 + 系统声音）依赖 ffmpeg。

## 当前策略（v0.2 公测版）

- `lib.rs` 的 `start_system_recording` 调用系统 PATH 里的 `ffmpeg`（Windows 默认 gdigrab 桌面 + dshow 立体声混音）。
- 前端 UI 已做降级：桌面版 ffmpeg 不可用时**自动回退网页录屏**（标签页声音 + 麦克风），保证任何用户都能录制。
- 若本机安装 ffmpeg（`winget install ffmpeg` 或官网下载并加入 PATH），桌面版立即启用系统级录制（含对方扬声器声音）。

## 后续：内置 ffmpeg（sidecar 打包）

把 `ffmpeg.exe` 放入本目录并命名 `ffmpeg-x86_64-pc-windows-msvc.exe`，
配合 `tauri.conf.json` 的 `bundle.externalBin`（`binaries/ffmpeg`）即可随应用分发；
`lib.rs` 改用 `tauri::process::Command` 调用 sidecar，实现"开箱即用"的系统录屏。

> 公测版先以"系统 ffmpeg + 网页回退"发布，内置 ffmpeg 作为 v0.2.1 增强，避免阻塞首版 release。
