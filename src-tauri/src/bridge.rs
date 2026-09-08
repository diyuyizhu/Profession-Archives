/// 嵌入式本地桥 HTTP 服务器
///
/// 在 Tauri 进程内运行，监听 127.0.0.1:8000，为 Chrome 插件提供通信通道。
/// 不依赖 Node.js / Fastify —— 纯 Rust，启动即在线。
///
/// 职责：
/// - 生成/持久化配对 token（前端展示 → 插件 popup 粘贴 → Bearer 校验）
/// - 接收插件请求（岗位采集、投递回传、表单映射）
/// - 采集数据暂存 JSON inbox（前端按需拉取 → 合并到 localStorage → 清空）
use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

use crate::ai::{self, AiCapability};

// ── Inbox 条目类型（与 extension 回传字段对齐） ──

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum BridgeItem {
    #[serde(rename = "job")]
    Job {
        id: String,
        company: String,
        title: String,
        url: Option<String>,
        jd: Option<String>,
        channel: Option<String>,
        tags: Vec<String>,
        snapshot: Option<String>,
        collected_at: String,
    },
    #[serde(rename = "application")]
    Application {
        application_id: String,
        company: Option<String>,
        title: Option<String>,
        status: String,
        applied_at: Option<String>,
        note: Option<String>,
        reported_at: String,
    },
    #[serde(rename = "form-mapping")]
    FormMapping {
        id: String,
        origin: String,
        field_key: String,
        field_label: Option<String>,
        control_type: Option<String>,
        target_field: String,
        saved_at: String,
    },
}

// ── 桥持久化状态 ──

#[derive(serde::Serialize, serde::Deserialize)]
struct BridgeStore {
    pairing_token: String,
    inbox: VecDeque<BridgeItem>,
}

impl BridgeStore {
    fn load(path: &PathBuf) -> Self {
        match fs::read_to_string(path) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_else(|_| Self::fresh()),
            Err(_) => Self::fresh(),
        }
    }

    fn save(&self, path: &PathBuf) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = fs::write(path, json);
        }
    }

    fn fresh() -> Self {
        Self {
            pairing_token: Self::gen_token(),
            inbox: VecDeque::new(),
        }
    }

    fn gen_token() -> String {
        // 无需 uuid crate：时间戳 + 随机字节 → 32 字符 hex
        use std::time::{SystemTime, UNIX_EPOCH};
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let mut buf = [0u8; 12];
        // 用纳秒时间戳的低位填充 + 简单混合
        buf[0] = (ts >> 56) as u8;
        buf[1] = (ts >> 48) as u8;
        buf[2] = (ts >> 40) as u8;
        buf[3] = (ts >> 32) as u8;
        buf[4] = (ts >> 24) as u8;
        buf[5] = (ts >> 16) as u8;
        buf[6] = (ts >> 8) as u8;
        buf[7] = (ts >> 0) as u8;
        // 混合更多位使 token 不单调
        for i in 0..12 {
            buf[i] = buf[i].wrapping_add(buf[i % 8].rotate_left(3));
        }
        format!(
            "pa-{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}",
            buf[0],
            buf[1],
            buf[2],
            buf[3],
            buf[4],
            buf[5],
            buf[6],
            buf[7],
            buf[8],
            buf[9],
            buf[10],
            buf[11],
        )
    }
}

// ── 桥运行时 ──

pub struct BridgeHandle {
    shutdown: Arc<std::sync::atomic::AtomicBool>,
}

impl BridgeHandle {
    /// 启动桥 HTTP 服务器，绑定 127.0.0.1:8000，在后台线程运行。
    /// 返回 handle 供关闭时调用 `stop()`。
    pub fn start(app_data_dir: PathBuf) -> Result<Self, String> {
        let store_path = app_data_dir.join("bridge-store.json");
        let store = Arc::new(Mutex::new(BridgeStore::load(&store_path)));
        // 首次启动立即落盘配对 token（否则纯 AI 填充用户重启后 token 轮换）
        store.lock().unwrap().save(&store_path);
        let store_clone = Arc::clone(&store);
        let path_clone = store_path.clone();
        let dir_clone = app_data_dir.clone();
        let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let shutdown_clone = Arc::clone(&shutdown);

        let server =
            Server::http("127.0.0.1:8000").map_err(|e| format!("无法启动桥服务: {e}"))?;

        thread::spawn(move || {
            eprintln!("[bridge] 监听 127.0.0.1:8000");
            loop {
                if shutdown_clone.load(std::sync::atomic::Ordering::Relaxed) {
                    break;
                }
                match server.recv_timeout(Duration::from_millis(250)) {
                    Ok(Some(request)) => {
                        let s = Arc::clone(&store_clone);
                        let p = path_clone.clone();
                        let d = dir_clone.clone();
                        thread::spawn(move || handle(request, s, p, d));
                    }
                    Ok(None) => {} // timeout, check shutdown
                    Err(e) => {
                        eprintln!("[bridge] 接收错误: {e}");
                        break;
                    }
                }
            }
            eprintln!("[bridge] 已停止");
        });

        Ok(Self { shutdown })
    }

    pub fn stop(&self) {
        self.shutdown
            .store(true, std::sync::atomic::Ordering::Relaxed);
    }
}

// ── 请求处理 ──

fn handle(mut req: Request, store: Arc<Mutex<BridgeStore>>, store_path: PathBuf, app_data_dir: PathBuf) {
    let method = req.method().clone();
    let url = req.url().to_string();

    // 去除 query string 用于路由匹配
    let path = url.split('?').next().unwrap_or(&url).to_string();

    // CORS 预检
    if method == Method::Options {
        respond_cors(req, 204, "");
        return;
    }

    // ── 路由分发 ──
    let (status, body) = if path == "/health" {
        // 健康检查（无需配对）
        (200, r#"{"status":"ok"}"#.to_string())
    } else if path == "/api/bridge/pairing" {
        // 获取配对 token（无需认证；前端展示用）
        let guard = store.lock().unwrap();
        (200, format!(r#"{{"token":"{}"}}"#, guard.pairing_token))
    } else if path == "/api/automation/profile" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            let summary = read_profile_summary(&app_data_dir);
            (200, format!(r#"{{"ok":true,"profile":{}}}"#, summary))
        }
    } else if path == "/api/bridge/sync" && method == Method::Post {
        // 前端同步 AI 配置 + 档案摘要到桥
        match read_body(&mut req) {
            Ok(raw) => match apply_sync(&raw, &app_data_dir) {
                Ok(()) => (200, r#"{"ok":true}"#.to_string()),
                Err(e) => (400, e),
            },
            Err(e) => (400, e),
        }
    } else if path == "/api/automation/ai/analyze-fields" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => run_ai(&app_data_dir, AiCapability::AnalyzeFields, &raw),
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/ai/extract-job" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => run_ai(&app_data_dir, AiCapability::ExtractJob, &raw),
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/ai/generate-resume" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => run_ai(&app_data_dir, AiCapability::GenerateResume, &raw),
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/ai/parse-resume" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => run_ai(&app_data_dir, AiCapability::ParseResume, &raw),
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/job" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => match parse_job(&raw) {
                    Ok(item) => {
                        let mut guard = store.lock().unwrap();
                        let id = if let BridgeItem::Job { ref id, .. } = item { id.clone() } else { String::new() };
                        guard.inbox.push_back(item);
                        guard.save(&store_path);
                        (200, format!(r#"{{"ok":true,"id":"{}"}}"#, id))
                    }
                    Err(e) => (400, e),
                },
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/application" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else {
            match read_body(&mut req) {
                Ok(raw) => match parse_application(&raw) {
                    Ok(item) => {
                        let mut guard = store.lock().unwrap();
                        guard.inbox.push_back(item);
                        guard.save(&store_path);
                        (200, r#"{"ok":true}"#.to_string())
                    }
                    Err(e) => (400, e),
                },
                Err(e) => (400, e),
            }
        }
    } else if path == "/api/automation/form-mapping" {
        let auth = check_auth(&req, &store);
        if let Err(e) = auth {
            (401, e)
        } else if method == Method::Post {
            // 保存表单字段映射（upsert：同 origin+field_key 覆盖旧映射）
            match read_body(&mut req) {
                Ok(raw) => match parse_form_mapping(&raw) {
                    Ok(item) => {
                        let mut guard = store.lock().unwrap();
                        if let BridgeItem::FormMapping { origin, field_key, .. } = &item {
                            guard.inbox.retain(|existing| {
                                !matches!(existing,
                                    BridgeItem::FormMapping { origin: o, field_key: k, .. }
                                        if o == origin && k == field_key)
                            });
                        }
                        guard.inbox.push_back(item);
                        guard.save(&store_path);
                        (200, r#"{"ok":true}"#.to_string())
                    }
                    Err(e) => (400, e),
                },
                Err(e) => (400, e),
            }
        } else {
            // GET: 查询 per-origin
            let origin = req
                .url()
                .split('?')
                .nth(1)
                .and_then(|q| {
                    q.split('&')
                        .find(|p| p.starts_with("origin="))
                        .map(|p| p.trim_start_matches("origin=").to_string())
                })
                .unwrap_or_default();
            let guard = store.lock().unwrap();
            let mappings: Vec<&BridgeItem> = guard
                .inbox
                .iter()
                .filter(|item| {
                    if let BridgeItem::FormMapping { origin: ref o, .. } = item {
                        o == &origin
                    } else {
                        false
                    }
                })
                .collect();
            let json = serde_json::to_string(&mappings).unwrap_or_else(|_| "[]".into());
            (200, format!(r#"{{"ok":true,"mappings":{}}}"#, json))
        }
    } else if path == "/api/bridge/inbox" {
        // 拉取 inbox 中所有待同步条目
        let guard = store.lock().unwrap();
        let json = serde_json::to_string(&guard.inbox).unwrap_or_else(|_| "[]".into());
        (200, json)
    } else if path == "/api/bridge/inbox/clear" {
        // 清空 inbox：仅清除 job/application（待同步数据），form-mapping 记忆保留
        let mut guard = store.lock().unwrap();
        guard
            .inbox
            .retain(|item| matches!(item, BridgeItem::FormMapping { .. }));
        guard.save(&store_path);
        (200, r#"{"ok":true}"#.to_string())
    } else {
        (404, format!(r#"{{"error":"未知路径: {}"}}"#, url))
    };

    let mut resp = Response::from_string(body).with_status_code(StatusCode(status as u16));

    let ct = Header::from_bytes(
        &b"Content-Type"[..],
        &b"application/json; charset=utf-8"[..],
    )
    .unwrap();
    resp.add_header(ct);

    // CORS：白名单回显 origin（拒绝的 origin 不设 ACAO，浏览器阻断读取）
    if let Some(origin) = allowed_origin(&req) {
        if !origin.is_empty() {
            if let Ok(acao) =
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], origin.as_bytes())
            {
                resp.add_header(acao);
            }
        }
    }

    let _ = req.respond(resp);
}

// ── 工具函数 ──

/// 响应 CORS 预检（OPTIONS）
fn respond_cors(req: Request, status: u16, _body: &str) {
    let mut resp = Response::from_string("").with_status_code(status);
    // 预检按 origin 白名单回显；拒绝则不带 ACAO，浏览器阻断实际请求（CSRF 防护）
    if let Some(origin) = allowed_origin(&req) {
        if !origin.is_empty() {
            if let Ok(h) = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], origin.as_bytes())
            {
                resp.add_header(h);
            }
        }
    }
    if let Ok(h) =
        Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..])
    {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(
        &b"Access-Control-Allow-Headers"[..],
        &b"Content-Type, Authorization, X-PA-Client"[..],
    ) {
        resp.add_header(h);
    }
    let _ = req.respond(resp);
}

/// 判断请求 origin 是否在白名单；返回应回显的 origin（空串 = 无 origin 不设 ACAO，None = 拒绝）
fn allowed_origin(req: &Request) -> Option<String> {
    let origin = req
        .headers()
        .iter()
        .find(|h| h.field.equiv("Origin"))
        .map(|h| h.value.as_str().to_string());
    match origin {
        None => Some(String::new()),
        Some(o) if o == "null" => Some(o),
        Some(o) => {
            // 浏览器扩展
            if o.starts_with("chrome-extension://") {
                return Some(o);
            }
            // Tauri webview
            if o.starts_with("tauri://")
                || o.starts_with("http://tauri.localhost")
                || o.starts_with("https://tauri.localhost")
            {
                return Some(o);
            }
            // localhost / 127.0.0.1 任意端口
            let rest = o
                .strip_prefix("http://")
                .or_else(|| o.strip_prefix("https://"));
            if let Some(rest) = rest {
                let host = rest
                    .split('/')
                    .next()
                    .unwrap_or(rest)
                    .split(':')
                    .next()
                    .unwrap_or(rest);
                if host == "localhost" || host == "127.0.0.1" {
                    return Some(o);
                }
            }
            None // 其他 origin 拒绝（不放 ACAO，浏览器阻断读取）
        }
    }
}

/// 校验 Bearer 配对 token
fn check_auth(
    req: &Request,
    store: &Arc<Mutex<BridgeStore>>,
) -> Result<(), String> {
    let auth_header = req
        .headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))
        .map(|h| h.value.as_str())
        .unwrap_or("");
    let token = auth_header.trim_start_matches("Bearer ");
    if token.is_empty() {
        return Err(r#"{"error":"未配对：缺少配对 token"}"#.to_string());
    }
    let guard = store.lock().unwrap();
    if token != guard.pairing_token {
        return Err(
            r#"{"error":"未配对：请先在桌面端复制配对码并在插件 popup 粘贴"}"#
                .to_string(),
        );
    }
    Ok(())
}

/// 读取请求体
fn read_body(req: &mut Request) -> Result<String, String> {
    let mut buf = Vec::new();
    req.as_reader()
        .read_to_end(&mut buf)
        .map_err(|e| format!(r#"{{"error":"读取请求体失败：{e}"}}"#))?;
    String::from_utf8(buf).map_err(|e| format!(r#"{{"error":"请求体不是 UTF-8：{e}"}}"#))
}

/// 生成 36 字符 ID（时间戳 + 随机混合）
fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!(
        "br-{:08x}-{:04x}-{:04x}",
        (ts >> 32) as u32,
        (ts >> 16) as u16,
        ts as u16 ^ ((ts >> 48) as u16),
    )
}

// ── 请求解析 ──

fn parse_job(raw: &str) -> Result<BridgeItem, String> {
    let v: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| format!(r#"{{"error":"JSON 解析失败：{e}"}}"#))?;

    let company = get_str(&v, "company").ok_or(r#"{{"error":"需提供 company"}}"#.to_string())?;
    let title = get_str(&v, "title").ok_or(r#"{{"error":"需提供 title"}}"#.to_string())?;

    Ok(BridgeItem::Job {
        id: gen_id(),
        company,
        title,
        url: get_str(&v, "url"),
        jd: get_str(&v, "jd"),
        channel: get_str(&v, "channel"),
        tags: v
            .get("tags")
            .and_then(|t| t.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
        snapshot: get_str(&v, "snapshot"),
        collected_at: chrono_now(),
    })
}

fn parse_application(raw: &str) -> Result<BridgeItem, String> {
    let v: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| format!(r#"{{"error":"JSON 解析失败：{e}"}}"#))?;

    Ok(BridgeItem::Application {
        application_id: get_str(&v, "applicationId").unwrap_or_default(),
        company: get_str(&v, "company"),
        title: get_str(&v, "title"),
        status: get_str(&v, "status").unwrap_or_else(|| "applied".to_string()),
        applied_at: get_str(&v, "appliedAt"),
        note: get_str(&v, "note"),
        reported_at: chrono_now(),
    })
}

fn parse_form_mapping(raw: &str) -> Result<BridgeItem, String> {
    let v: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| format!(r#"{{"error":"JSON 解析失败：{e}"}}"#))?;

    let origin =
        get_str(&v, "origin").ok_or(r#"{{"error":"需提供 origin"}}"#.to_string())?;
    let field_key =
        get_str(&v, "field_key").ok_or(r#"{{"error":"需提供 field_key"}}"#.to_string())?;
    let target_field =
        get_str(&v, "target_field").ok_or(r#"{{"error":"需提供 target_field"}}"#.to_string())?;

    Ok(BridgeItem::FormMapping {
        id: gen_id(),
        origin,
        field_key,
        field_label: get_str(&v, "field_label"),
        control_type: get_str(&v, "control_type"),
        target_field,
        saved_at: chrono_now(),
    })
}

fn get_str(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|s| s.as_str()).map(|s| s.to_string())
}

fn chrono_now() -> String {
    // ISO 8601 格式时间，不依赖 chrono crate
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = ts.as_secs();
    // 1970 + secs → 粗略 UTC 日期（忽略闰秒）
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let h = time_secs / 3600;
    let m = (time_secs % 3600) / 60;
    let s = time_secs % 60;

    // 从 epoch 推算年月日（简化算法，对 1970-2100 范围足够）
    let (y, mo, d) = days_to_date(days as i64);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y,
        mo,
        d,
        h,
        m,
        s,
        ts.subsec_millis()
    )
}

fn days_to_date(mut days: i64) -> (i64, i64, i64) {
    // 1970-01-01 起的天数 → (年, 月, 日)
    let mut year = 1970i64;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let month_days = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1i64;
    for &md in month_days.iter() {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

// ── 档案摘要 / AI 同步 ──

/// 读取前端同步的档案摘要（填表所需 5 字段），无文件返回 "null"
fn read_profile_summary(app_data_dir: &PathBuf) -> String {
    let path = app_data_dir.join("profile-summary.json");
    match fs::read_to_string(&path) {
        Ok(text) if !text.trim().is_empty() => text,
        _ => "null".to_string(),
    }
}

/// 处理前端 /api/bridge/sync：同步 aiConfig + profileSummary
fn apply_sync(raw: &str, app_data_dir: &PathBuf) -> Result<(), String> {
    let v: serde_json::Value = serde_json::from_str(raw)
        .map_err(|e| format!(r#"{{"error":"JSON 解析失败：{e}"}}"#))?;
    if let Some(cfg) = v.get("aiConfig") {
        let cfg: ai::AiConfig = serde_json::from_value(cfg.clone())
            .map_err(|e| format!(r#"{{"error":"aiConfig 解析失败：{e}"}}"#))?;
        ai::save_config(app_data_dir, &cfg)?;
    }
    if let Some(summary) = v.get("profileSummary") {
        let path = app_data_dir.join("profile-summary.json");
        let json = serde_json::to_string_pretty(summary)
            .map_err(|e| format!(r#"{{"error":"profileSummary 序列化失败：{e}"}}"#))?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 调用 AI 并按能力包装返回
fn run_ai(app_data_dir: &PathBuf, cap: AiCapability, raw: &str) -> (u16, String) {
    let input = extract_ai_input(raw);
    match ai::call_ai(app_data_dir, cap, &input) {
        Ok(text) => match cap {
            AiCapability::GenerateResume => {
                let escaped = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".into());
                (200, format!(r#"{{"ok":true,"text":{}}}"#, escaped))
            }
            _ => {
                // analyze-fields / extract-job / parse-resume 需要 JSON 结果
                match serde_json::from_str::<serde_json::Value>(&extract_json(&text)) {
                    Ok(v) => {
                        let key = match cap {
                            AiCapability::AnalyzeFields => "mappings",
                            AiCapability::ExtractJob => "job",
                            _ => "parsed",
                        };
                        let payload = match cap {
                            AiCapability::AnalyzeFields => v
                                .get("mappings")
                                .cloned()
                                .unwrap_or(serde_json::json!([])),
                            _ => v,
                        };
                        (200, format!(r#"{{"ok":true,"{}":{}}}"#, key, payload))
                    }
                    Err(_) => (
                        502,
                        r#"{"error":"AI 返回不是合法 JSON"}"#.to_string(),
                    ),
                }
            }
        },
        Err(e) => (502, format!(r#"{{"error":"{}"}}"#, e)),
    }
}

/// 从请求体提取给 AI 的 input 文本
fn extract_ai_input(raw: &str) -> String {
    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(v) => {
            if let Some(fields) = v.get("fields") {
                fields.to_string()
            } else if let Some(text) = v.get("text").and_then(|s| s.as_str()) {
                text.to_string()
            } else if v.get("jd").is_some() || v.get("profile").is_some() {
                format!(
                    "JD:\n{}\n\n个人档案:\n{}",
                    v.get("jd").and_then(|s| s.as_str()).unwrap_or(""),
                    v.get("profile").and_then(|s| s.as_str()).unwrap_or(""),
                )
            } else {
                raw.to_string()
            }
        }
        Err(_) => raw.to_string(),
    }
}

/// 从 AI 返回文本中提取 JSON（处理 ```json ... ``` 包裹与前后缀噪声）
fn extract_json(text: &str) -> String {
    let trimmed = text.trim();
    let inner = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```")
            .trim_start_matches("json")
            .trim_start_matches('\n')
            .trim_end_matches("```")
            .trim()
            .to_string()
    } else {
        trimmed.to_string()
    };
    if let (Some(s), Some(e)) = (inner.find('{'), inner.rfind('}')) {
        inner[s..=e].to_string()
    } else {
        inner
    }
}
