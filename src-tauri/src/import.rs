//! 文件文本提取（档案导入）：PDF（pdf-extract）/ DOCX（zip + XML 抽文本）→ 纯文本。
//!
//! 对应 Node 侧 `server/src/routes/import-text.ts` 的能力，但**桌面端不启动 Node**
//! （桥由 `bridge.rs` 内置），故这里是打包版唯一实现，路由 `/api/import/extract-text`。
//!
//! POST { filename, content_base64 } → { ok: true, text } / { error }
//!
//! 为什么 PDF 必须走服务端：中文字体常用 CID 编码，纯前端无法可靠还原文本
//! （DOCX 前端有零依赖兜底，见 frontend/src/lib/docxExtract.ts）。

use std::io::{Cursor, Read};

use base64::Engine as _;

/// 单文件上限（与 Node 侧 import-text.ts 保持一致）
const MAX_BYTES: usize = 20 * 1024 * 1024;

/// 错误串在响应里截断的长度，避免把整篇解析栈回传给前端
const ERR_MAX_CHARS: usize = 200;

/// 提取纯文本。
/// Ok(text) = 成功；Err((HTTP 状态码, 人类可读消息)) = 失败。
pub fn extract_text(filename: &str, content_base64: &str) -> Result<String, (u16, String)> {
    if content_base64.trim().is_empty() {
        return Err((400, "需提供 content_base64".to_string()));
    }

    // btoa 产物无换行，但容忍外部调用方带空白
    let compact: String = content_base64.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = decode_base64(&compact)
        .map_err(|_| (400, "content_base64 非法".to_string()))?;

    if bytes.len() > MAX_BYTES {
        return Err((413, "文件超过 20MB 上限".to_string()));
    }

    let name = filename.to_lowercase();
    let text = if name.ends_with(".pdf") {
        let raw = extract_pdf(&bytes)?;
        normalize(&raw, "PDF")
    } else if name.ends_with(".docx") {
        let raw = extract_docx(&bytes)?;
        normalize(&raw, "DOCX")
    } else if name.ends_with(".doc") {
        return Err((415, "旧版 .doc 不支持，请另存为 .docx".to_string()));
    } else {
        return Err((415, "仅支持 .pdf / .docx".to_string()));
    }?;

    Ok(text)
}

/// 宽松 base64 解码：先按标准表（含 padding），失败再按无 padding 表重试
fn decode_base64(input: &str) -> Result<Vec<u8>, base64::DecodeError> {
    let std_engine = base64::engine::general_purpose::STANDARD;
    match std_engine.decode(input) {
        Ok(v) => Ok(v),
        Err(_) => base64::engine::general_purpose::STANDARD_NO_PAD.decode(input),
    }
}

/// PDF → 文本（pdf-extract 内部处理 ToUnicode CMap / CID 字体，中文简历可用）
fn extract_pdf(bytes: &[u8]) -> Result<String, (u16, String)> {
    pdf_extract::extract_text_from_mem(bytes)
        .map_err(|e| (502, format!("PDF 解析失败：{}", truncate(&e.to_string()))))
}

/// DOCX → 文本：解压 word/document.xml 后按 WordprocessingML 规则抽文本
fn extract_docx(bytes: &[u8]) -> Result<String, (u16, String)> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|e| (502, format!("DOCX 解析失败：{}", truncate(&e.to_string()))))?;
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|_| (502, "DOCX 缺少 word/document.xml（文件可能损坏）".to_string()))?
        .read_to_string(&mut xml)
        .map_err(|e| (502, format!("DOCX 读取失败：{}", truncate(&e.to_string()))))?;
    Ok(xml_to_text(&xml))
}

/// 统一后处理：去 \r、合并连续空行、trim；空文本报 422（扫描件/纯图片）
fn normalize(raw: &str, kind: &str) -> Result<String, (u16, String)> {
    let no_cr = raw.replace('\r', "");
    let mut lines: Vec<&str> = Vec::new();
    let mut blank = false;
    for line in no_cr.lines() {
        let t = line.trim_end();
        if t.trim().is_empty() {
            if !blank && !lines.is_empty() {
                lines.push("");
            }
            blank = true;
        } else {
            lines.push(t);
            blank = false;
        }
    }
    let text = lines.join("\n").trim().to_string();
    if text.is_empty() {
        return Err((
            422,
            format!("{kind} 未提取到文本（可能是扫描件/纯图片）"),
        ));
    }
    Ok(text)
}

/// WordprocessingML → 纯文本：
/// `<w:p>` 段落 / `<w:br>` 换行 / `<w:tr>` 表格行 → 换行；`<w:tab>` → 制表符；
/// 其余标签丢弃；文本节点解码 XML 实体。
fn xml_to_text(xml: &str) -> String {
    let mut out = String::with_capacity(xml.len() / 2);
    let bytes = xml.as_bytes();
    let mut i = 0usize;

    while i < bytes.len() {
        if bytes[i] == b'<' {
            // 取到本标签结束的 '>'（ASCII，索引必落在 UTF-8 边界上）
            let end = match xml[i..].find('>') {
                Some(off) => i + off,
                None => break, // 截断的标签：丢弃剩余
            };
            let inner = xml[i + 1..end].trim_start();
            let is_end = inner.starts_with('/');
            let inner = inner.trim_start_matches('/').trim_start();
            let name = inner
                .split(|c: char| c.is_whitespace() || c == '/')
                .next()
                .unwrap_or("");
            // 只在段落/行**结束**时换行（起始标签也换会翻倍）；<w:br>/<w:tab> 是自闭合标签
            if is_end {
                if matches!(name, "w:p" | "w:tr") {
                    out.push('\n');
                }
            } else if matches!(name, "w:br" | "w:cr") {
                out.push('\n');
            } else if name == "w:tab" {
                out.push('\t');
            }
            i = end + 1;
        } else {
            // 文本节点：到下一个 '<' 为止
            let next = xml[i..].find('<').map(|off| i + off).unwrap_or(bytes.len());
            decode_entities(&xml[i..next], &mut out);
            i = next;
        }
    }
    out
}

/// 解码 XML 实体（命名实体 + `&#123;` / `&#x1F;` 数字实体），无法识别的原样保留
fn decode_entities(raw: &str, out: &mut String) {
    let mut rest = raw;
    while let Some(pos) = rest.find('&') {
        out.push_str(&rest[..pos]);
        let tail = &rest[pos..];
        let Some(semi) = tail.find(';') else {
            out.push_str(tail);
            return;
        };
        let entity = &tail[1..semi];
        let decoded = match entity {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            _ => entity
                .strip_prefix("#x")
                .or_else(|| entity.strip_prefix("#X"))
                .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                .or_else(|| entity.strip_prefix('#').and_then(|dec| dec.parse::<u32>().ok()))
                .and_then(char::from_u32),
        };
        match decoded {
            Some(c) => {
                out.push(c);
                rest = &tail[semi + 1..];
            }
            None => {
                // 非实体（如 URL 里的裸 &）：保留 '&' 继续扫描
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
}

/// 截断到 ERR_MAX_CHARS 个字符（按字符而非字节，避免切坏 UTF-8）
fn truncate(s: &str) -> String {
    s.chars().take(ERR_MAX_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_paragraphs_and_entities() {
        let xml = r#"<w:body><w:p><w:r><w:t>张三 &amp; 李四</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body>"#;
        assert_eq!(xml_to_text(xml).trim(), "张三 & 李四\n第二段");
    }

    #[test]
    fn xml_tab_and_numeric_entities() {
        let xml = r#"<w:p><w:r><w:t>A</w:t></w:r><w:tab/><w:r><w:t>&#x4E2D;&#25991;</w:t></w:r></w:p>"#;
        assert_eq!(xml_to_text(xml).trim(), "A\t中文");
    }

    #[test]
    fn rejects_unknown_extension() {
        let err = extract_text("resume.txt", "aGVsbG8=").unwrap_err();
        assert_eq!(err.0, 415);
    }

    #[test]
    fn rejects_bad_base64() {
        let err = extract_text("resume.pdf", "!!!not base64!!!").unwrap_err();
        assert_eq!(err.0, 400);
    }

    #[test]
    fn empty_text_is_422() {
        // 合法 PDF 头但没有文本流 → 提取为空
        let minimal = b"%PDF-1.4\n%%EOF\n";
        let b64 = base64::engine::general_purpose::STANDARD.encode(minimal);
        let err = extract_text("empty.pdf", &b64).unwrap_err();
        assert!(err.0 == 422 || err.0 == 502, "got {:?}", err);
    }

    #[test]
    fn extracts_chinese_pdf_text() {
        // 真实中文 PDF（reportlab + SimHei 生成，字体子集内嵌）：
        // 覆盖 CID/ToUnicode 路径 —— 中文简历若走错编码会提取成乱码
        let bytes = include_bytes!("../tests/fixtures/sample-resume-cn.pdf");
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        let text = extract_text("resume.pdf", &b64).expect("应能提取中文 PDF");
        assert!(text.contains("张三"), "应含姓名，实际：{text}");
        assert!(text.contains("后端开发"), "应含岗位，实际：{text}");
        assert!(text.contains("Kubernetes"), "应含英文技能，实际：{text}");
    }
}
