//! 桌面端（Tauri 2）：窗口 + 系统级录制（屏幕 + 系统声音）。
//!
//! 系统录制实现：调用 ffmpeg ——
//!   Windows: `-f gdigrab`（桌面）+ `-f dshow -i audio=立体声混音`（系统扬声器输出）
//!   macOS:   `-f avfoundation "1:0"`（屏幕 + 系统音频）
//!   Linux:   `-f x11grab` + `-f pulse`（默认音频）
//!
//! 说明：纯网页 getDisplayMedia 只能录标签页声音/麦克风，无法录系统声音；
//! 系统级录制必须由桌面端完成（前端通过 invoke 触发，见 ApplicationDetailView）。
//!
//! ⚠️ 需要 Rust 工具链编译（阶段 0 前置），ffmpeg 需随应用打包或本机安装。

use std::io::Write;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, State};

/// 一次进行中的录制：ffmpeg 子进程 + 其 stdin（用于发送 'q' 优雅结束）
struct ActiveRecording {
    child: Child,
    stdin: ChildStdin,
}

struct RecordingState(Mutex<Option<ActiveRecording>>);

#[derive(serde::Serialize)]
struct RecordingMeta {
    path: String,
    file_name: String,
}

/// 消毒文件名片段：去掉路径分隔符与 Windows 非法字符，防目录逃逸
fn sanitize_label(label: &str) -> String {
    let cleaned: String = label
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\n' | '\r') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let cleaned = cleaned.replace("..", "__").trim().to_string();
    if cleaned.is_empty() {
        "interview".to_string()
    } else {
        cleaned
    }
}

/// 输出目录：<app_data_dir>/recordings/<消毒后label>-<时间戳>.mp4
fn output_path(app: &tauri::AppHandle, label: &str) -> Result<(String, String), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let file_name = format!("{}-{ts}.mp4", sanitize_label(label));
    let path = dir.join(&file_name);
    Ok((path.to_string_lossy().to_string(), file_name))
}

fn lock<'a>(state: &'a State<'_, RecordingState>) -> Result<std::sync::MutexGuard<'a, Option<ActiveRecording>>, String> {
    state.0.lock().map_err(|_| "录制状态已损坏（内部锁中毒）".to_string())
}

/// 开始系统级录制（屏幕 + 系统声音）。需要本机安装 ffmpeg。
#[tauri::command]
fn start_system_recording(
    app: tauri::AppHandle,
    state: State<'_, RecordingState>,
    label: Option<String>,
) -> Result<RecordingMeta, String> {
    let mut guard = lock(&state)?;
    if guard.is_some() {
        return Err("已有录制进行中".into());
    }
    let (path, file_name) = output_path(&app, &label.unwrap_or_else(|| "interview".to_string()))?;

    // Windows 默认：gdigrab 桌面 + 立体声混音（系统声音）。设备名因机器而异，可后续在设置中配置。
    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-f",
        "gdigrab",
        "-framerate",
        "15",
        "-i",
        "desktop",
        "-f",
        "dshow",
        "-i",
        "audio=立体声混音",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        &path,
    ])
    .stdin(Stdio::piped()) // 优雅停止：向 stdin 发送 'q'
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    // 非 Windows：默认参数（见模块注释）
    #[cfg(not(windows))]
    {
        cmd = Command::new("ffmpeg");
        #[cfg(target_os = "macos")]
        cmd.args(["-y", "-f", "avfoundation", "-framerate", "15", "-i", "1:0", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", &path]);
        #[cfg(target_os = "linux")]
        cmd.args(["-y", "-f", "x11grab", "-framerate", "15", "-i", ":0.0", "-f", "pulse", "-i", "default", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", &path]);
        cmd.stdin(Stdio::piped());
    }

    let mut child = cmd.spawn().map_err(|e| format!("启动 ffmpeg 失败（请确认已安装 ffmpeg）：{e}"))?;
    let stdin = child.stdin.take().ok_or("无法获取 ffmpeg 输入流")?;
    *guard = Some(ActiveRecording { child, stdin });
    Ok(RecordingMeta { path, file_name })
}

/// 停止系统级录制：向 ffmpeg stdin 发送 'q' 优雅结束（写出完整文件），超时则强制终止。
#[tauri::command]
fn stop_system_recording(state: State<'_, RecordingState>) -> Result<(), String> {
    let mut guard = lock(&state)?;
    let mut rec = guard.take().ok_or("没有进行中的录制")?;

    // 优雅结束：写 'q' 让 ffmpeg 正常收尾（写 moov atom，文件可播放）
    if rec.stdin.write_all(b"q").is_ok() {
        let _ = rec.stdin.flush();
        drop(rec.stdin);
    }
    // 等待退出（最多 ~5s），超时则强制 kill
    for _ in 0..50 {
        match rec.child.try_wait() {
            Ok(Some(_status)) => return Ok(()),
            Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
            Err(e) => {
                let _ = rec.child.kill();
                return Err(format!("等待 ffmpeg 退出失败：{e}"));
            }
        }
    }
    let _ = rec.child.kill();
    let _ = rec.child.wait();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            _app.manage(RecordingState(Mutex::new(None)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_system_recording, stop_system_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
