/**
 * 岗位市场 store（模块 G）：岗位库 CRUD + 来源配置 + 去重导入 + 收藏 + 转入投递。
 *
 * 职责边界：**本 store 不抓取任何站点**。抓取由两类外部执行者负责 ——
 * ① 浏览器插件（在你已登录的页面采集，走桥 /api/automation/job）；
 * ② 你自己跑的独立抓取服务（爬虫与主程序分离，经桥 /api/job-source/fetch 代理转发）。
 * store 只消费结果：规整 → 去重 → 入库。
 */
import type { JobPayload, JobPosting } from '@pa/shared'
import {
  DEFAULT_JOB_SOURCES,
  dedupeJobs,
  jobKey,
  jobToApplicationDraft,
  normalizeRemoteJob,
  type JobSourceConfig,
  type JobSourceKind,
} from '@pa/shared/job'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { uid } from '@/data/seed'
import { bridgeRequest } from '@/lib/bridge'
import { useApplicationStore } from '@/stores/application'

const JOBS_KEY = 'pa-jobs-v1'
const SOURCES_KEY = 'pa-job-sources-v1'

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`[jobs] 保存 ${key} 失败`, err)
    throw err
  }
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []

/** 岗位结构校验：坏数据丢弃字段而非整条丢弃（岗位来之不易） */
function sanitizeJobs(raw: unknown): JobPosting[] {
  if (!Array.isArray(raw)) return []
  const ts = new Date().toISOString()
  return raw
    .filter((j): j is Record<string, unknown> => Boolean(j) && typeof j === 'object')
    .map((j) => ({
      id: str(j.id) || uid('job'),
      title: str(j.title),
      company: str(j.company),
      source_id: str(j.source_id, 'manual'),
      external_id: typeof j.external_id === 'string' ? j.external_id : undefined,
      url: typeof j.url === 'string' ? j.url : undefined,
      city: typeof j.city === 'string' ? j.city : undefined,
      salary: typeof j.salary === 'string' ? j.salary : undefined,
      education: typeof j.education === 'string' ? j.education : undefined,
      experience: typeof j.experience === 'string' ? j.experience : undefined,
      job_type: typeof j.job_type === 'string' ? j.job_type : undefined,
      jd: typeof j.jd === 'string' ? j.jd : undefined,
      tags: strArr(j.tags),
      company_tags: strArr(j.company_tags),
      starred: j.starred === true,
      application_id: typeof j.application_id === 'string' ? j.application_id : undefined,
      match_score: typeof j.match_score === 'number' ? j.match_score : undefined,
      match_reason: typeof j.match_reason === 'string' ? j.match_reason : undefined,
      posted_at: typeof j.posted_at === 'string' ? j.posted_at : undefined,
      deadline: typeof j.deadline === 'string' ? j.deadline : undefined,
      properties:
        j.properties && typeof j.properties === 'object' && !Array.isArray(j.properties)
          ? (j.properties as JobPosting['properties'])
          : undefined,
      created_at: str(j.created_at) || ts,
      updated_at: str(j.updated_at) || ts,
    }))
    .filter((j) => j.title || j.company)
}

const SOURCE_KINDS: JobSourceKind[] = ['manual', 'plugin', 'service', 'web']

function sanitizeSources(raw: unknown): JobSourceConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_JOB_SOURCES.map((s) => ({ ...s }))
  const out: JobSourceConfig[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    if (typeof s.id !== 'string' || !s.id.trim()) continue
    out.push({
      id: s.id.trim(),
      name: str(s.name) || s.id,
      kind: SOURCE_KINDS.includes(s.kind as JobSourceKind) ? (s.kind as JobSourceKind) : 'manual',
      endpoint: typeof s.endpoint === 'string' ? s.endpoint : undefined,
      homepage: typeof s.homepage === 'string' ? s.homepage : undefined,
      enabled: s.enabled !== false,
      note: typeof s.note === 'string' ? s.note : undefined,
    })
  }
  return out.length ? out : DEFAULT_JOB_SOURCES.map((s) => ({ ...s }))
}

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<JobPosting[]>(sanitizeJobs(load(JOBS_KEY)))
  const sources = ref<JobSourceConfig[]>(sanitizeSources(load(SOURCES_KEY)))

  const total = computed(() => jobs.value.length)
  const starredCount = computed(() => jobs.value.filter((j) => j.starred).length)
  const transferredCount = computed(() => jobs.value.filter((j) => j.application_id).length)
  /** 已有岗位的去重键集合 */
  const existingKeys = computed(() => new Set(jobs.value.map((j) => jobKey(j))))

  function persist(): void {
    save(JOBS_KEY, jobs.value)
  }
  function persistSources(): void {
    save(SOURCES_KEY, sources.value)
  }

  function sourceOf(id: string): JobSourceConfig | undefined {
    return sources.value.find((s) => s.id === id)
  }
  function sourceName(id: string): string {
    return sourceOf(id)?.name ?? id
  }

  /* ── 岗位 CRUD ── */

  /** 新增岗位（按去重键跳过重复）；返回新岗位，重复则返回 null */
  function addJob(payload: JobPayload): JobPosting | null {
    const key = jobKey(payload)
    if (existingKeys.value.has(key)) return null
    const ts = new Date().toISOString()
    const job: JobPosting = { id: uid('job'), ...payload, created_at: ts, updated_at: ts }
    jobs.value = [job, ...jobs.value]
    persist()
    return job
  }

  function updateJob(id: string, patch: Partial<JobPayload>): void {
    jobs.value = jobs.value.map((j) =>
      j.id === id ? { ...j, ...patch, updated_at: new Date().toISOString() } : j,
    )
    persist()
  }

  function removeJob(id: string): void {
    jobs.value = jobs.value.filter((j) => j.id !== id)
    persist()
  }

  function removeMany(ids: string[]): number {
    const set = new Set(ids)
    const before = jobs.value.length
    jobs.value = jobs.value.filter((j) => !set.has(j.id))
    persist()
    return before - jobs.value.length
  }

  function toggleStar(id: string): void {
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return
    updateJob(id, { starred: !job.starred })
  }

  /** 写入自定义属性值（空值 = 清除该键） */
  function setProperty(id: string, propertyId: string, value: unknown): void {
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return
    const next = { ...(job.properties ?? {}) }
    const isEmpty =
      value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
    if (isEmpty) delete next[propertyId]
    else next[propertyId] = value as never
    updateJob(id, { properties: Object.keys(next).length ? next : undefined })
  }

  function clearPropertyValues(propertyId: string): void {
    let touched = false
    jobs.value = jobs.value.map((j) => {
      if (!j.properties || !(propertyId in j.properties)) return j
      const next = { ...j.properties }
      delete next[propertyId]
      touched = true
      return { ...j, properties: Object.keys(next).length ? next : undefined, updated_at: new Date().toISOString() }
    })
    if (touched) persist()
  }

  /* ── 导入（外部服务 / 插件采集的结果） ── */

  /**
   * 导入一批外部原始记录：规整 → 按去重键过滤 → 入库。
   * 返回 { added, duplicates, invalid }，供 UI 如实反馈。
   */
  function importRaw(
    rawList: unknown[],
    sourceId: string,
  ): { added: number; duplicates: number; invalid: number } {
    const normalized: JobPayload[] = []
    let invalid = 0
    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') {
        invalid++
        continue
      }
      const job = normalizeRemoteJob(raw as Record<string, unknown>, sourceId)
      if (!job) {
        invalid++
        continue
      }
      normalized.push({ ...job, properties: undefined })
    }
    const keys = new Set(existingKeys.value)
    const { fresh, duplicates } = dedupeJobs(normalized, keys)
    if (fresh.length) {
      const ts = new Date().toISOString()
      jobs.value = [
        ...fresh.map((j) => ({ id: uid('job'), ...j, created_at: ts, updated_at: ts }) as JobPosting),
        ...jobs.value,
      ]
      persist()
    }
    return { added: fresh.length, duplicates, invalid }
  }

  /**
   * 从外部抓取服务拉一批岗位（经本地桥代理，避免 webview 直连的 CORS 与混合内容问题）。
   * 服务协议见 shared/job.ts 的 JOB_SOURCE_PROTOCOL。
   */
  async function fetchFromService(
    sourceId: string,
    params: { query?: string; city?: string; page?: number; limit?: number } = {},
  ): Promise<{ added: number; duplicates: number; invalid: number; total?: number }> {
    const source = sourceOf(sourceId)
    if (!source) throw new Error(`来源不存在：${sourceId}`)
    if (source.kind !== 'service') throw new Error(`来源「${source.name}」不是外部抓取服务`)
    if (!source.endpoint?.trim()) throw new Error(`请先为「${source.name}」填写服务地址`)

    const data = await bridgeRequest<{ jobs?: unknown[]; total?: number }>('/api/job-source/fetch', {
      method: 'POST',
      body: JSON.stringify({ endpoint: source.endpoint.trim(), params }),
    })
    const list = Array.isArray(data.jobs) ? data.jobs : []
    const result = importRaw(list, sourceId)
    return { ...result, total: data.total }
  }

  /* ── 转入投递看板 ── */

  /**
   * 把岗位转成一条投递记录（落首列），并回写 application_id 建立双向关联。
   * 已转入过的岗位直接返回原投递 id，避免重复建条。
   */
  function transferToApplication(id: string): string | null {
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return null
    const appStore = useApplicationStore()
    if (job.application_id && appStore.applications.some((a) => a.id === job.application_id)) {
      return job.application_id
    }
    const app = appStore.addApplication(jobToApplicationDraft(job, appStore.firstColumnId))
    updateJob(id, { application_id: app.id })
    return app.id
  }

  /* ── 来源配置 ── */

  function updateSource(id: string, patch: Partial<JobSourceConfig>): void {
    sources.value = sources.value.map((s) => (s.id === id ? { ...s, ...patch } : s))
    persistSources()
  }

  function addSource(name: string, kind: JobSourceKind, endpoint?: string, homepage?: string): JobSourceConfig {
    const source: JobSourceConfig = {
      id: uid('src'),
      name: name.trim() || '新来源',
      kind,
      endpoint: endpoint?.trim() || undefined,
      homepage: homepage?.trim() || undefined,
      enabled: true,
    }
    sources.value = [...sources.value, source]
    persistSources()
    return source
  }

  function removeSource(id: string): void {
    sources.value = sources.value.filter((s) => s.id !== id)
    persistSources()
  }

  function resetSources(): void {
    sources.value = DEFAULT_JOB_SOURCES.map((s) => ({ ...s }))
    persistSources()
  }

  function clearAllJobs(): void {
    jobs.value = []
    persist()
  }

  return {
    jobs,
    sources,
    total,
    starredCount,
    transferredCount,
    existingKeys,
    sourceOf,
    sourceName,
    addJob,
    updateJob,
    removeJob,
    removeMany,
    toggleStar,
    setProperty,
    clearPropertyValues,
    importRaw,
    fetchFromService,
    transferToApplication,
    updateSource,
    addSource,
    removeSource,
    resetSources,
    clearAllJobs,
  }
})
