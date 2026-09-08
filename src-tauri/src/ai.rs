/// AI 服务（桥内调用 OpenAI 兼容接口：DeepSeek 云端 / Ollama 本地）
///
/// 翻译自 server/src/services/aiService.ts 的逻辑：
/// - 读 ai-config.json（前端同步）
/// - SSRF / API Key 泄漏防护（云端 https + 非内网；本地仅 localhost）
/// - E3 隐私授权（云端需 consent，localOnly 强制本地）
use std::path::PathBuf;
use std::time::Duration;

/// AI 能力（对应 4 个 prompt 模板）
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AiCapability {
    AnalyzeFields,
    ExtractJob,
    GenerateResume,
    ParseResume,
}

/// 与 shared AIConfig 对齐的配置结构（前端 JSON 为 camelCase）
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    #[serde(default = "default_provider")]
    pub provider: String, // "cloud" | "local"
    #[serde(default = "default_cloud_endpoint")]
    pub cloud_endpoint: String,
    #[serde(default = "default_cloud_model")]
    pub cloud_model: String,
    #[serde(default)]
    pub cloud_api_key: String,
    #[serde(default = "default_local_endpoint")]
    pub local_endpoint: String,
    #[serde(default = "default_local_model")]
    pub local_model: String,
    #[serde(default)]
    pub data_exit_consented: bool,
    #[serde(default)]
    pub local_only: bool,
}

fn default_provider() -> String {
    "cloud".into()
}
fn default_cloud_endpoint() -> String {
    "https://api.deepseek.com".into()
}
fn default_cloud_model() -> String {
    "deepseek-chat".into()
}
fn default_local_endpoint() -> String {
    "http://localhost:11434/v1".into()
}
fn default_local_model() -> String {
    "qwen2.5:7b".into()
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            cloud_endpoint: default_cloud_endpoint(),
            cloud_model: default_cloud_model(),
            cloud_api_key: String::new(),
            local_endpoint: default_local_endpoint(),
            local_model: default_local_model(),
            data_exit_consented: false,
            local_only: false,
        }
    }
}

/// 从 ai-config.json 加载配置（无文件/坏文件回退默认）
pub fn load_config(app_data_dir: &PathBuf) -> AiConfig {
    let path = app_data_dir.join("ai-config.json");
    match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => AiConfig::default(),
    }
}

/// 保存配置到 ai-config.json
pub fn save_config(app_data_dir: &PathBuf, cfg: &AiConfig) -> Result<(), String> {
    let path = app_data_dir.join("ai-config.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// 各能力对应 prompt（仿 aiService.ts 的 PROMPTS）
fn prompt_of(cap: AiCapability) -> &'static str {
    match cap {
        AiCapability::AnalyzeFields => {
            "你是招聘表单字段识别器。输入是表单字段列表（JSON，每项含 index/key、name、id、label、placeholder、type、附近文本）。判断每个字段对应哪个档案字段，输出 JSON：{\"mappings\":[{\"key\":\"<原始key或index>\",\"target\":\"<档案字段>\",\"confidence\":0-1}]}。档案字段枚举：full_name/email/phone/headline/summary/resume；无法判断填 other。只输出 JSON，不要解释。"
        }
        AiCapability::ExtractJob => {
            "你是招聘信息提取器。从给定的招聘页面文本中提取结构化岗位信息，输出 JSON：{\"company\":\"\",\"title\":\"\",\"jd\":\"\",\"skills\":[],\"location\":\"\",\"salary\":\"\"}。缺失字段用空字符串或空数组。只输出 JSON，不要解释。"
        }
        AiCapability::GenerateResume => {
            "你是简历撰写专家。根据给定的个人档案与岗位 JD，生成一份针对该岗位的特化简历正文（Markdown），突出匹配 JD 的经历与技能。直接输出简历正文。"
        }
        AiCapability::ParseResume => {
            "你是简历解析器。从给定的简历文本中提取结构化信息，输出 JSON：{\"full_name\":\"\",\"email\":\"\",\"phone\":\"\",\"headline\":\"\",\"summary\":\"\",\"skills\":[{\"name\":\"\",\"category\":\"\",\"level\":0}],\"experiences\":[{\"role\":\"\",\"company\":\"\",\"description_md\":\"\",\"start_date\":\"\",\"end_date\":\"\"}],\"education\":[{\"school\":\"\",\"degree\":\"\",\"major\":\"\",\"start_date\":\"\",\"end_date\":\"\"}],\"projects\":[{\"name\":\"\",\"summary\":\"\",\"description_md\":\"\"}]}。缺失字段用空字符串或空数组。只输出 JSON，不要解释。"
        }
    }
}

/// Endpoint 安全校验（SSRF / Key 泄漏防护），翻译自 assertSafeEndpoint
fn assert_safe_endpoint(endpoint: &str, is_cloud: bool) -> Result<(), String> {
    let u = url(endpoint)?;
    let host = u.host.to_lowercase();
    if is_cloud {
        if u.scheme != "https" {
            return Err("云端 Endpoint 必须使用 https".into());
        }
        let unsafe_host = host == "localhost"
            || host.ends_with(".localhost")
            || host == "127.0.0.1"
            || host == "::1"
            || host.starts_with("10.")
            || host.starts_with("192.168.")
            || is_172_private(&host)
            || host.starts_with("169.254.")
            || host.starts_with("0.")
            || host.starts_with("fe80:")
            || host.starts_with("fd")
            || host == "metadata.google.internal";
        if unsafe_host {
            return Err("云端 Endpoint 不允许指向本机/内网/链路本地地址".into());
        }
    } else if host != "localhost" && host != "127.0.0.1" && host != "::1" {
        return Err("本地 Endpoint 只能指向本机（localhost / 127.0.0.1）".into());
    }
    Ok(())
}

fn is_172_private(host: &str) -> bool {
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    if parts[0] != "172" {
        return false;
    }
    match parts[1].parse::<u32>() {
        Ok(n) => (16..=31).contains(&n),
        Err(_) => false,
    }
}

/// 极简 URL 解析（避免引入 url crate；endpoint 结构简单）
fn url(endpoint: &str) -> Result<UrlParts, String> {
    let (scheme, rest) = endpoint
        .split_once("://")
        .ok_or("Endpoint 不是合法 URL")?;
    let rest = rest.trim_end_matches('/');
    let hostport = rest.split('/').next().unwrap_or(rest);
    // 去 IPv6 方括号
    let hostport = hostport.trim_start_matches('[').trim_end_matches(']');
    // 去端口：单冒号是 host:port，多冒号是 IPv6（无端口）
    let host = if hostport.contains(':') {
        if hostport.matches(':').count() == 1 {
            hostport.split(':').next().unwrap_or(hostport)
        } else {
            hostport
        }
    } else {
        hostport
    };
    Ok(UrlParts {
        scheme: scheme.to_lowercase(),
        host: host.to_string(),
    })
}

struct UrlParts {
    scheme: String,
    host: String,
}

/// 调用 OpenAI 兼容接口，15s 超时
pub fn call_ai(
    app_data_dir: &PathBuf,
    cap: AiCapability,
    input: &str,
) -> Result<String, String> {
    let cfg = load_config(app_data_dir);

    // E3：localOnly 强制本地；云端需 consent
    let use_cloud = if cfg.local_only {
        false
    } else {
        cfg.provider == "cloud"
    };
    if use_cloud && !cfg.data_exit_consented {
        return Err("E3 未授权：云端 AI 调用需先在设置中授权数据出境".into());
    }

    let endpoint = if use_cloud { &cfg.cloud_endpoint } else { &cfg.local_endpoint };
    let model = if use_cloud { &cfg.cloud_model } else { &cfg.local_model };
    let api_key = if use_cloud { &cfg.cloud_api_key } else { "" };

    if endpoint.is_empty() || model.is_empty() {
        return Err("AI 未配置：请在设置页填写 Endpoint 与模型名".into());
    }
    if use_cloud && api_key.is_empty() {
        return Err("云端 AI 未配置 API Key".into());
    }
    assert_safe_endpoint(endpoint, use_cloud)?;

    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": prompt_of(cap) },
            { "role": "user", "content": input },
        ],
        "temperature": 0.6,
    });

    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(15))
        .build();

    let mut req = agent.post(&url).set("Content-Type", "application/json");
    if use_cloud {
        req = req.set("Authorization", &format!("Bearer {}", api_key));
    }

    let resp = req
        .send_string(&body.to_string())
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("AI 调用失败：HTTP {}", code),
            ureq::Error::Transport(t) => {
                if t.kind() == ureq::ErrorKind::Io
                    && t.to_string().contains("timed out")
                {
                    "AI 调用超时（15s）".to_string()
                } else {
                    format!("AI 调用失败：{}", t)
                }
            }
        })?;

    let data: serde_json::Value =
        resp.into_json().map_err(|e| format!("AI 响应解析失败：{}", e))?;
    let text = data
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(str::trim)
        .unwrap_or("")
        .to_string();
    if text.is_empty() {
        return Err("AI 返回为空".into());
    }
    Ok(text)
}
