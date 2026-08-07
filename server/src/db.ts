/**
 * 数据访问层：better-sqlite3 + 轻量 schema（Drizzle 迁移后续接入）。
 * 数据落盘于 <项目根>/.pa-data/profession-archives.sqlite3（本地优先，桌面应用随目录迁移）。
 */
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const DATA_DIR = process.env.PA_DATA_DIR ?? path.join(REPO_ROOT, '.pa-data')
mkdirSync(DATA_DIR, { recursive: true })

export const dbPath = path.join(DATA_DIR, 'profession-archives.sqlite3')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/** 对已存在的表补列（SQLite 无 ALTER ADD COLUMN IF NOT EXISTS，需查 pragma） */
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

/** 建表（幂等）；迁移策略后续接入 drizzle-kit */
export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT PRIMARY KEY,
      full_name   TEXT NOT NULL,
      headline    TEXT,
      email       TEXT,
      phone       TEXT,
      summary     TEXT,
      card_theme  TEXT NOT NULL DEFAULT 'trae',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      category    TEXT,
      level       INTEGER,
      tags_json   TEXT NOT NULL DEFAULT '[]',
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS experiences (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      company         TEXT,
      description_md  TEXT NOT NULL DEFAULT '',
      tags_json       TEXT NOT NULL DEFAULT '[]',
      start_date      TEXT,
      end_date        TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS education (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      school      TEXT NOT NULL,
      degree      TEXT,
      major       TEXT,
      start_date  TEXT,
      end_date    TEXT,
      description TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      summary         TEXT,
      description_md  TEXT NOT NULL DEFAULT '',
      tags_json       TEXT NOT NULL DEFAULT '[]',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      entry_type  TEXT NOT NULL CHECK (entry_type IN ('journal','achievement','milestone')),
      title       TEXT NOT NULL,
      content_md  TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      tags_json   TEXT NOT NULL DEFAULT '[]',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_journal_profile ON journal_entries(profile_id, occurred_at DESC);

    -- AI Provider 配置（E1；骨架表，接口接入后落地读写）
    CREATE TABLE IF NOT EXISTS ai_provider_config (
      id                INTEGER PRIMARY KEY CHECK (id = 1),
      provider          TEXT NOT NULL DEFAULT 'cloud',
      cloud_endpoint    TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
      cloud_model       TEXT NOT NULL DEFAULT 'deepseek-chat',
      cloud_api_key     TEXT NOT NULL DEFAULT '',
      local_endpoint    TEXT NOT NULL DEFAULT 'http://localhost:11434/v1',
      local_model       TEXT NOT NULL DEFAULT 'qwen2.5:7b',
      data_exit_consented INTEGER NOT NULL DEFAULT 0,
      local_only        INTEGER NOT NULL DEFAULT 0
    );

    -- 站点字段映射（D4；骨架表）
    CREATE TABLE IF NOT EXISTS form_mappings (
      id          TEXT PRIMARY KEY,
      origin      TEXT NOT NULL,
      field_key   TEXT NOT NULL,
      field_label TEXT,
      control_type TEXT,
      target_field TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_form_mappings_origin ON form_mappings(origin);

    -- 经历可信认证存证（服务端·招聘方验证）：只存哈希与时间戳，明文不上链
    CREATE TABLE IF NOT EXISTS attestations (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL,
      item_id     TEXT NOT NULL,
      item_label  TEXT,
      sha256      TEXT NOT NULL,
      not_before  TEXT NOT NULL,
      tx          TEXT,
      UNIQUE(profile_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_attestations_item ON attestations(item_id);

    -- 投递（B 模块：插件采集 / 投递回传落地）
    CREATE TABLE IF NOT EXISTS applications (
      id           TEXT PRIMARY KEY,
      company      TEXT NOT NULL,
      title        TEXT NOT NULL,
      url          TEXT,
      jd           TEXT,
      channel      TEXT,
      status       TEXT NOT NULL DEFAULT 'backlog',
      tags_json    TEXT NOT NULL DEFAULT '[]',
      notes        TEXT NOT NULL DEFAULT '',
      total_rounds INTEGER,
      importance   INTEGER,
      reject_reason TEXT,
      applied_at   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

    -- 状态变更日志（漏斗 / 审计）
    CREATE TABLE IF NOT EXISTS application_events (
      id             TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      from_status    TEXT,
      to_status      TEXT NOT NULL,
      at             TEXT NOT NULL DEFAULT (datetime('now')),
      note           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_application ON application_events(application_id);
  `)

  // ── 轻量迁移：旧表补列（CREATE TABLE IF NOT EXISTS 不会改已存在的表） ──
  ensureColumn('projects', 'start_date', 'TEXT')
  ensureColumn('projects', 'end_date', 'TEXT')
  ensureColumn('journal_entries', 'collection_id', 'TEXT')

  // 字段映射 per-origin 唯一：清理历史重复后建唯一索引，供插件去重记忆
  db.exec(`
    DELETE FROM form_mappings WHERE rowid NOT IN (SELECT MAX(rowid) FROM form_mappings GROUP BY origin, field_key);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_form_mappings_unique ON form_mappings(origin, field_key);
  `)
}

export { db }
