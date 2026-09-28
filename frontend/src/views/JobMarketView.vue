<script setup lang="ts">
/**
 * 岗位市场（模块 G）：岗位库 + 来源管理 + 收藏 / 转入投递。
 *
 * 定位：**先攒岗位，再决定投不投**。投递看板管"已经投出去的"，这里管"还没投的"。
 *
 * 数据来源与抓取完全解耦（本页不抓任何站点）：
 * - 手动录入
 * - 浏览器插件采集（复用你已登录的会话）
 * - 外部抓取服务（你自己跑的独立进程，协议见 shared/src/job.ts 的 JOB_SOURCE_PROTOCOL）
 * - 第三方聚合站点（如求职方舟）作为「来源之一」：打开站点 + 用插件采集
 *
 * 字段能力复用投递那一套多维表格机制：内置字段 + 自定义属性（同一套筛选 / 排序 / 视图）。
 */
import type { JobPosting, PropertyType } from '@pa/shared'
import { JOB_DEFAULT_VISIBLE_FIELDS, jobFields } from '@pa/shared/job'
import {
  OPERATOR_LABELS,
  PROPERTY_TYPE_ICONS,
  PROPERTY_TYPE_LABELS,
  matchesFilter,
  sortApplications,
  type ResolvedField,
  type SortRule,
} from '@pa/shared/property'
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import PropertyCell from '@/components/property/PropertyCell.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useApplicationStore } from '@/stores/application'
import { useJobPropertiesStore } from '@/stores/properties'
import { useJobsStore } from '@/stores/jobs'

const store = useJobsStore()
const propsStore = useJobPropertiesStore()
const appStore = useApplicationStore()

const flash = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
function notify(kind: 'ok' | 'error', text: string): void {
  flash.value = { kind, text }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), 4500)
}

/* ── 字段 ── */

const allFields = computed<ResolvedField[]>(() => jobFields(propsStore.properties))
const hiddenFields = computed(() => new Set(propsStore.activeView?.hidden ?? []))
const tableFields = computed<ResolvedField[]>(() => {
  const all = allFields.value
  const known = new Set(all.map((f) => f.key))
  const order = (propsStore.activeView?.columns ?? []).filter((k) => known.has(k))
  const ordered = order.map((k) => all.find((f) => f.key === k)!).filter(Boolean)
  const rest = all.filter((f) => !order.includes(f.key))
  const visible = [...ordered, ...rest].filter((f) => !hiddenFields.value.has(f.key))
  if (!propsStore.activeView && !showAllFields.value) {
    return visible.filter((f) => f.custom || JOB_DEFAULT_VISIBLE_FIELDS.includes(f.key))
  }
  return visible
})
const showAllFields = ref(false)

/* ── 快捷筛选 ── */

const search = ref('')
const filterSource = ref<string | null>(null)
const filterCity = ref<string | null>(null)
const filterType = ref<string | null>(null)
const starredOnly = ref(false)

const cities = computed(() => {
  const set = new Set<string>()
  for (const j of store.jobs) if (j.city?.trim()) set.add(j.city.trim())
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})
const jobTypes = computed(() => {
  const set = new Set<string>()
  for (const j of store.jobs) if (j.job_type?.trim()) set.add(j.job_type.trim())
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return store.jobs.filter((j) => {
    if (starredOnly.value && !j.starred) return false
    if (filterSource.value && j.source_id !== filterSource.value) return false
    if (filterCity.value && (j.city ?? '').trim() !== filterCity.value) return false
    if (filterType.value && (j.job_type ?? '').trim() !== filterType.value) return false
    if (!matchesFilter(j, propsStore.activeFilter)) return false
    if (!kw) return true
    const hay = [j.title, j.company, j.city, j.salary, j.jd, ...(j.tags ?? []), ...(j.company_tags ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(kw)
  })
})

/* ── 排序 ── */

const activeSort = computed<SortRule | null>(() => propsStore.activeSorts[0] ?? null)

function sortBy(field: string): void {
  const cur = activeSort.value
  const next: SortRule[] = [{ field, desc: cur?.field === field ? !cur.desc : false }]
  const view = propsStore.activeView
  if (view) propsStore.updateView(view.id, { sorts: next })
  else propsStore.saveView('默认排序', { sorts: next, kind: 'table' })
}

const rows = computed(() => {
  const sorts = propsStore.activeSorts
  if (sorts.length) return sortApplications(filtered.value, sorts)
  // 默认：收藏优先，其次发布时间倒序
  return [...filtered.value].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    return (b.posted_at ?? b.created_at).localeCompare(a.posted_at ?? a.created_at)
  })
})

/* ── 行选择 / 批量 ── */

const selected = ref<Set<string>>(new Set())
const selectedCount = computed(() => selected.value.size)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((j) => selected.value.has(j.id)),
)
function toggleRow(id: string): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function toggleAll(): void {
  selected.value = allSelected.value ? new Set() : new Set(rows.value.map((j) => j.id))
}
function clearSelection(): void {
  selected.value = new Set()
}

/* ── 操作 ── */

function star(id: string): void {
  try {
    store.toggleStar(id)
  } catch {
    notify('error', '保存失败：本地存储不可用或已满')
  }
}

function transfer(job: JobPosting): void {
  try {
    const appId = store.transferToApplication(job.id)
    if (appId) notify('ok', `已转入投递看板：${job.title || job.company}`)
    else notify('error', '转入失败')
  } catch {
    notify('error', '转入失败：本地存储不可用或已满')
  }
}

function removeJob(job: JobPosting): void {
  if (!window.confirm(`从岗位库删除「${job.title || job.company}」？（不影响已转入的投递）`)) return
  store.removeJob(job.id)
}

function removeSelected(): void {
  const n = selected.value.size
  if (!n) return
  if (!window.confirm(`删除选中的 ${n} 个岗位？（不影响已转入的投递）`)) return
  store.removeMany([...selected.value])
  clearSelection()
}

function openUrl(job: JobPosting): void {
  if (job.url) window.open(job.url, '_blank', 'noopener')
}

/* ── 详情弹窗 ── */

const detail = ref<JobPosting | null>(null)

/* ── 手动新增 ── */

const addOpen = ref(false)
const draft = ref({ title: '', company: '', city: '', salary: '', job_type: '', url: '', jd: '' })

function submitAdd(): void {
  if (!draft.value.title.trim() && !draft.value.company.trim()) return
  try {
    const job = store.addJob({
      title: draft.value.title.trim(),
      company: draft.value.company.trim(),
      source_id: 'manual',
      city: draft.value.city.trim() || undefined,
      salary: draft.value.salary.trim() || undefined,
      job_type: draft.value.job_type.trim() || undefined,
      url: draft.value.url.trim() || undefined,
      jd: draft.value.jd.trim() || undefined,
      tags: [],
      company_tags: [],
      starred: false,
    })
    if (!job) {
      notify('error', '岗位库里已有同名岗位（按公司+岗位+城市判重）')
      return
    }
    draft.value = { title: '', company: '', city: '', salary: '', job_type: '', url: '', jd: '' }
    addOpen.value = false
    notify('ok', '已加入岗位库')
  } catch {
    notify('error', '保存失败：本地存储不可用或已满')
  }
}

/* ── 从外部抓取服务拉取 ── */

const fetching = ref(false)
const serviceSources = computed(() => store.sources.filter((s) => s.kind === 'service'))
const enabledService = computed(() => serviceSources.value.find((s) => s.enabled) ?? null)

async function fetchFromService(): Promise<void> {
  const source = enabledService.value
  if (!source) {
    notify('error', '还没有启用的抓取服务 —— 到「来源设置」里填地址并启用')
    return
  }
  fetching.value = true
  try {
    const r = await store.fetchFromService(source.id, {
      query: search.value.trim() || undefined,
      city: filterCity.value ?? undefined,
      limit: 100,
    })
    notify(
      r.added ? 'ok' : 'error',
      `抓取完成：新增 ${r.added} 条，重复跳过 ${r.duplicates} 条${r.invalid ? `，无效 ${r.invalid} 条` : ''}`,
    )
  } catch (e) {
    notify('error', e instanceof Error ? e.message : String(e))
  } finally {
    fetching.value = false
  }
}

/* ── 来源设置 ── */

const sourcesOpen = ref(false)
const newSource = ref({ name: '', kind: 'service' as 'service' | 'web', endpoint: '', homepage: '' })

function addSource(): void {
  if (!newSource.value.name.trim()) return
  store.addSource(newSource.value.name, newSource.value.kind, newSource.value.endpoint, newSource.value.homepage)
  newSource.value = { name: '', kind: 'service', endpoint: '', homepage: '' }
}

function openSourceHome(homepage?: string): void {
  if (homepage) window.open(homepage, '_blank', 'noopener')
}

/* ── 自定义属性 ── */

const addPropOpen = ref(false)
const newProp = ref({ name: '', type: 'text' as PropertyType })
const PROPERTY_TYPE_OPTIONS = (Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => ({
  type: t,
  label: PROPERTY_TYPE_LABELS[t],
  icon: PROPERTY_TYPE_ICONS[t],
}))

function submitAddProp(): void {
  if (!newProp.value.name.trim()) return
  propsStore.addProperty(newProp.value.name, newProp.value.type)
  newProp.value = { name: '', type: 'text' }
  addPropOpen.value = false
}

function fieldOf(key: string): ResolvedField | undefined {
  return allFields.value.find((f) => f.key === key)
}

/** 内置字段的只读文本（自定义属性走 PropertyCell） */
function builtinText(job: JobPosting, key: string): string {
  if (key === 'source_id') return store.sourceName(job.source_id)
  if (key === 'match_score') return job.match_score === undefined ? '—' : `${job.match_score} 分`
  const v = (job as unknown as Record<string, unknown>)[key]
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.join('、') : '—'
  return String(v)
}

// appStore 仅用于「转入投递后」校验投递是否存在（保持引用，避免未使用告警）
void appStore
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-[1400px] px-6 pb-10">
      <PageHeader code="G" title="岗位市场" desc="先攒岗位，再决定投不投 —— 来源可插拔，抓取与主程序分离" />

      <div
        v-if="flash"
        role="status"
        aria-live="polite"
        class="card-glass mb-4 px-4 py-2.5 text-[12.5px]"
        :class="flash.kind === 'ok' ? 'text-neutral-600' : 'text-red-600'"
      >
        {{ flash.kind === 'ok' ? '✓' : '✕' }} {{ flash.text }}
      </div>

      <!-- 概览 + 工具栏 -->
      <section class="card-glass mb-4 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="search"
            class="input-trae h-9 min-w-[180px] flex-1 text-[12.5px]"
            placeholder="🔍 搜索岗位 / 公司 / 城市 / JD / 标签…"
          />
          <select v-model="filterSource" class="input-trae h-9 w-auto appearance-none text-[12.5px]">
            <option :value="null">全部来源</option>
            <option v-for="s in store.sources" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <select v-if="cities.length" v-model="filterCity" class="input-trae h-9 w-auto appearance-none text-[12.5px]">
            <option :value="null">全部城市</option>
            <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-if="jobTypes.length" v-model="filterType" class="input-trae h-9 w-auto appearance-none text-[12.5px]">
            <option :value="null">全部类型</option>
            <option v-for="t in jobTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <button
            class="rounded-lg border px-3 py-1.5 text-[12px] transition-colors"
            :class="starredOnly ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500 hover:border-neutral-900'"
            @click="starredOnly = !starredOnly"
          >
            ★ 只看收藏
          </button>
          <SecondaryButton @click="fetchFromService">
            {{ fetching ? '抓取中…' : '⬇ 从抓取服务拉取' }}
          </SecondaryButton>
          <SecondaryButton @click="addOpen = true">＋ 手动新增</SecondaryButton>
          <SecondaryButton @click="sourcesOpen = true">⚙ 来源设置</SecondaryButton>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neutral-400">
          <span>岗位库 <b class="text-neutral-900">{{ store.total }}</b> 条</span>
          <span>收藏 <b class="text-neutral-700">{{ store.starredCount }}</b></span>
          <span>已转入投递 <b class="text-neutral-700">{{ store.transferredCount }}</b></span>
          <span>当前筛选后 <b class="text-neutral-700">{{ rows.length }}</b></span>
          <span v-if="enabledService" class="text-neutral-500">抓取服务：{{ enabledService.name }} · {{ enabledService.endpoint }}</span>
          <span v-else class="text-neutral-400">未启用抓取服务（来源设置里配置）</span>
        </div>
      </section>

      <!-- 批量操作 -->
      <div
        v-if="selectedCount"
        class="card-glass mb-3 flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]"
      >
        <span class="font-medium text-neutral-900">已选 {{ selectedCount }} 个岗位</span>
        <button class="ml-auto rounded border border-red-300 px-2 py-1 text-[11.5px] text-red-600 hover:border-red-500" @click="removeSelected">
          删除选中
        </button>
        <button class="rounded px-2 py-1 text-[11.5px] text-neutral-400 hover:text-neutral-900" @click="clearSelection">取消选择</button>
      </div>

      <!-- 岗位表格 -->
      <section class="card-glass overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead class="bg-white">
              <tr class="border-b border-neutral-200">
                <th class="w-[36px] py-2 pl-3">
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 accent-neutral-900"
                    :checked="allSelected"
                    :indeterminate.prop="selectedCount > 0 && !allSelected"
                    aria-label="全选"
                    @change="toggleAll"
                  />
                </th>
                <th class="w-[44px] py-2 text-[11px] font-medium text-neutral-400">收藏</th>
                <th
                  v-for="f in tableFields"
                  :key="f.key"
                  class="whitespace-nowrap py-2 pl-3 pr-3 text-[11px] font-medium text-neutral-400"
                >
                  <button class="flex items-center gap-1 hover:text-neutral-900" :title="`按「${f.name}」排序`" @click="sortBy(f.key)">
                    <span class="text-[10px] text-neutral-300">{{ f.custom && f.type ? PROPERTY_TYPE_ICONS[f.type] : '·' }}</span>
                    <span :class="activeSort?.field === f.key ? 'text-neutral-900' : ''">{{ f.name }}</span>
                    <span v-if="activeSort?.field === f.key" class="text-[10px]">{{ activeSort.desc ? '↓' : '↑' }}</span>
                  </button>
                </th>
                <th class="w-[132px] py-2 pr-3 text-[11px] font-medium text-neutral-400">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="job in rows"
                :key="job.id"
                class="border-b border-neutral-100 transition-colors last:border-0"
                :class="selected.has(job.id) ? 'bg-neutral-100' : 'hover:bg-neutral-50'"
              >
                <td class="py-1.5 pl-3">
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 accent-neutral-900"
                    :checked="selected.has(job.id)"
                    :aria-label="`选择 ${job.title}`"
                    @change="toggleRow(job.id)"
                  />
                </td>
                <td class="py-1.5 text-center">
                  <button
                    class="text-[14px] leading-none transition-colors"
                    :class="job.starred ? 'text-neutral-900' : 'text-neutral-300 hover:text-neutral-600'"
                    :title="job.starred ? '取消收藏' : '收藏'"
                    @click="star(job.id)"
                  >
                    ★
                  </button>
                </td>
                <td v-for="f in tableFields" :key="f.key" class="max-w-[240px] py-1.5 pl-3 pr-3 align-middle">
                  <PropertyCell
                    v-if="f.custom"
                    :field="f"
                    :value="job.properties?.[f.key]"
                    @update="store.setProperty(job.id, f.key, $event)"
                  />
                  <template v-else-if="f.key === 'title'">
                    <button class="truncate text-left text-[12.5px] font-medium text-neutral-900 hover:underline" @click="detail = job">
                      {{ job.title || '未命名岗位' }}
                    </button>
                  </template>
                  <template v-else-if="f.key === 'company_tags' || f.key === 'tags'">
                    <span class="flex flex-wrap gap-1">
                      <span
                        v-for="t in (f.key === 'tags' ? job.tags : job.company_tags)"
                        :key="t"
                        class="rounded px-1 py-0.5 text-[10px]"
                        :class="f.key === 'tags' ? 'bg-neutral-100 text-neutral-600' : 'border border-neutral-300 text-neutral-700'"
                      >
                        {{ t }}
                      </span>
                      <span v-if="!(f.key === 'tags' ? job.tags : job.company_tags).length" class="text-neutral-300">—</span>
                    </span>
                  </template>
                  <template v-else-if="f.key === 'match_score'">
                    <span v-if="job.match_score === undefined" class="text-neutral-300">—</span>
                    <span v-else class="font-mono text-[12px] text-neutral-900">{{ job.match_score }}</span>
                  </template>
                  <template v-else>
                    <span class="block truncate text-[12px] text-neutral-600" :title="builtinText(job, f.key)">
                      {{ builtinText(job, f.key) }}
                    </span>
                  </template>
                </td>
                <td class="py-1.5 pr-3">
                  <div class="flex items-center gap-1.5">
                    <button
                      v-if="!job.application_id"
                      class="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-700 transition-colors hover:border-neutral-900"
                      title="在投递看板建一条记录（落首列）"
                      @click="transfer(job)"
                    >
                      转入投递
                    </button>
                    <span v-else class="rounded border border-neutral-900 bg-neutral-900 px-1.5 py-0.5 text-[11px] text-white" title="已转入投递看板">
                      已转入
                    </span>
                    <button v-if="job.url" class="rounded px-1.5 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-900" @click="openUrl(job)">
                      原页
                    </button>
                    <button class="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:text-red-600" @click="removeJob(job)">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!rows.length" class="py-14 text-center text-[12.5px] text-neutral-400">
          <p v-if="!store.total">岗位库还是空的 —— 用「手动新增」，或配好抓取服务后点「从抓取服务拉取」</p>
          <p v-else>当前筛选没有匹配的岗位</p>
        </div>

        <!-- 表尾：新增属性 -->
        <div class="flex items-center gap-2 border-t border-neutral-100 px-3 py-2">
          <button
            class="rounded border border-dashed border-neutral-300 px-2 py-0.5 text-[11.5px] text-neutral-400 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            @click="addPropOpen = true"
          >
            ＋ 新增属性
          </button>
          <label class="ml-auto flex items-center gap-1.5 text-[11px] text-neutral-400">
            <input v-model="showAllFields" type="checkbox" class="h-3.5 w-3.5 accent-neutral-900" />
            显示全部内置列
          </label>
        </div>
      </section>
    </div>

    <!-- 岗位详情 -->
    <Modal v-if="detail" :title="detail.title || '岗位详情'" max-width="max-w-2xl" @close="detail = null">
      <div class="space-y-3 text-[12.5px]">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div><span class="text-neutral-400">公司</span><div class="text-neutral-900">{{ detail.company || '—' }}</div></div>
          <div><span class="text-neutral-400">城市</span><div class="text-neutral-900">{{ detail.city || '—' }}</div></div>
          <div><span class="text-neutral-400">薪资</span><div class="text-neutral-900">{{ detail.salary || '—' }}</div></div>
          <div><span class="text-neutral-400">类型</span><div class="text-neutral-900">{{ detail.job_type || '—' }}</div></div>
          <div><span class="text-neutral-400">学历</span><div class="text-neutral-900">{{ detail.education || '—' }}</div></div>
          <div><span class="text-neutral-400">经验</span><div class="text-neutral-900">{{ detail.experience || '—' }}</div></div>
          <div><span class="text-neutral-400">来源</span><div class="text-neutral-900">{{ store.sourceName(detail.source_id) }}</div></div>
          <div><span class="text-neutral-400">发布</span><div class="text-neutral-900">{{ detail.posted_at || '—' }}</div></div>
          <div><span class="text-neutral-400">截止</span><div class="text-neutral-900">{{ detail.deadline || '—' }}</div></div>
        </div>
        <div v-if="detail.company_tags.length" class="flex flex-wrap gap-1">
          <span v-for="t in detail.company_tags" :key="t" class="rounded border border-neutral-300 px-1.5 py-0.5 text-[10.5px] text-neutral-700">{{ t }}</span>
        </div>
        <pre v-if="detail.jd" class="max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[12px] leading-relaxed text-neutral-600">{{ detail.jd }}</pre>
        <p v-else class="text-neutral-400">（没有 JD 正文）</p>
        <div class="flex items-center justify-end gap-2 border-t border-neutral-200 pt-3">
          <SecondaryButton v-if="detail.url" @click="openUrl(detail)">打开原页面</SecondaryButton>
          <PrimaryButton v-if="!detail.application_id" @click="transfer(detail)">转入投递看板</PrimaryButton>
          <span v-else class="text-[12px] text-neutral-500">已转入投递看板</span>
        </div>
      </div>
    </Modal>

    <!-- 手动新增 -->
    <Modal v-if="addOpen" title="手动新增岗位" max-width="max-w-lg" @close="addOpen = false">
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">岗位名称</span>
            <input v-model="draft.title" class="input-trae" placeholder="如 后端开发工程师" /></label>
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">公司</span>
            <input v-model="draft.company" class="input-trae" placeholder="可留空" /></label>
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">城市</span>
            <input v-model="draft.city" class="input-trae" placeholder="如 北京" /></label>
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">薪资</span>
            <input v-model="draft.salary" class="input-trae" placeholder="如 20-35K" /></label>
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">类型</span>
            <input v-model="draft.job_type" class="input-trae" placeholder="校招 / 实习 / 社招" /></label>
          <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">岗位链接</span>
            <input v-model="draft.url" class="input-trae" placeholder="https://" /></label>
        </div>
        <label class="block"><span class="mb-1 block text-[11.5px] text-neutral-500">JD 正文</span>
          <textarea v-model="draft.jd" class="input-trae min-h-[140px] resize-y py-2.5 text-[12.5px]" placeholder="粘贴职位描述（用于后续 AI 匹配打分）" /></label>
        <div class="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <SecondaryButton @click="addOpen = false">取消</SecondaryButton>
          <PrimaryButton :disabled="!draft.title.trim() && !draft.company.trim()" @click="submitAdd">加入岗位库</PrimaryButton>
        </div>
      </div>
    </Modal>

    <!-- 新增属性 -->
    <Modal v-if="addPropOpen" title="新增岗位属性" max-width="max-w-md" @close="addPropOpen = false">
      <div class="space-y-4">
        <label class="block"><span class="mb-1.5 block text-[12px] text-neutral-500">名称</span>
          <input v-model="newProp.name" class="input-trae" placeholder="如「是否内推」「期望薪资」" @keydown.enter="submitAddProp" /></label>
        <div>
          <div class="mb-2 text-[12px] text-neutral-500">类型</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in PROPERTY_TYPE_OPTIONS"
              :key="opt.type"
              class="rounded-full border px-2.5 py-1 text-[11.5px] transition-colors"
              :class="newProp.type === opt.type ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-300 text-neutral-500'"
              @click="newProp.type = opt.type"
            >
              {{ opt.icon }} {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-200 pt-3">
          <SecondaryButton @click="addPropOpen = false">取消</SecondaryButton>
          <PrimaryButton :disabled="!newProp.name.trim()" @click="submitAddProp">新增</PrimaryButton>
        </div>
      </div>
    </Modal>

    <!-- 来源设置 -->
    <Modal v-if="sourcesOpen" title="岗位来源设置" max-width="max-w-2xl" @close="sourcesOpen = false">
      <div class="space-y-4 text-[12.5px]">
        <p class="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11.5px] leading-relaxed text-neutral-500">
          抓取不内置在本应用里。外部抓取服务需自行实现一个 <code>GET /jobs</code> 接口（返回 <code>{{ '{' }}"jobs":[…]{{ '}' }}</code>），
          本应用经本地桥转发请求（避免 CORS）。协议字段见 <code>shared/src/job.ts</code> 的 <code>JOB_SOURCE_PROTOCOL</code>。
        </p>

        <div class="space-y-2">
          <div v-for="s in store.sources" :key="s.id" class="rounded-lg border border-neutral-200 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <label class="flex items-center gap-2">
                <input type="checkbox" class="h-3.5 w-3.5 accent-neutral-900" :checked="s.enabled" @change="store.updateSource(s.id, { enabled: ($event.target as HTMLInputElement).checked })" />
                <span class="font-medium text-neutral-900">{{ s.name }}</span>
              </label>
              <span class="rounded-full border border-neutral-300 px-1.5 py-0.5 text-[10.5px] text-neutral-500">
                {{ s.kind === 'service' ? '外部抓取服务' : s.kind === 'web' ? '站点入口' : s.kind === 'plugin' ? '插件采集' : '手动' }}
              </span>
              <button v-if="s.homepage" class="rounded px-1.5 py-0.5 text-[11px] text-neutral-500 hover:text-neutral-900" @click="openSourceHome(s.homepage)">打开站点</button>
              <button v-if="s.kind !== 'manual' && s.kind !== 'plugin'" class="ml-auto rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:text-red-600" @click="store.removeSource(s.id)">删除</button>
            </div>
            <p v-if="s.note" class="mt-1 text-[11px] leading-relaxed text-neutral-400">{{ s.note }}</p>
            <div v-if="s.kind === 'service'" class="mt-2 flex items-center gap-2">
              <span class="shrink-0 text-[11.5px] text-neutral-400">服务地址</span>
              <input
                class="input-trae h-8 flex-1 text-[12px]"
                placeholder="http://127.0.0.1:8790"
                :value="s.endpoint ?? ''"
                @change="store.updateSource(s.id, { endpoint: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div v-if="s.kind === 'web'" class="mt-2 flex items-center gap-2">
              <span class="shrink-0 text-[11.5px] text-neutral-400">站点地址</span>
              <input
                class="input-trae h-8 flex-1 text-[12px]"
                :value="s.homepage ?? ''"
                @change="store.updateSource(s.id, { homepage: ($event.target as HTMLInputElement).value })"
              />
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-dashed border-neutral-300 p-3">
          <div class="mb-2 text-[12px] font-medium text-neutral-600">新增来源</div>
          <div class="flex flex-wrap items-center gap-2">
            <input v-model="newSource.name" class="input-trae h-8 w-[150px] text-[12px]" placeholder="来源名称" />
            <select v-model="newSource.kind" class="input-trae h-8 w-auto appearance-none text-[12px]">
              <option value="service">外部抓取服务</option>
              <option value="web">站点入口</option>
            </select>
            <input v-if="newSource.kind === 'service'" v-model="newSource.endpoint" class="input-trae h-8 flex-1 text-[12px]" placeholder="http://127.0.0.1:8790" />
            <input v-else v-model="newSource.homepage" class="input-trae h-8 flex-1 text-[12px]" placeholder="https://站点首页" />
            <SecondaryButton :disabled="!newSource.name.trim()" @click="addSource">添加</SecondaryButton>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-neutral-200 pt-3">
          <button class="text-[12px] text-neutral-400 hover:text-neutral-900" @click="store.resetSources()">恢复默认来源</button>
          <PrimaryButton @click="sourcesOpen = false">完成</PrimaryButton>
        </div>
      </div>
    </Modal>
  </div>
</template>
