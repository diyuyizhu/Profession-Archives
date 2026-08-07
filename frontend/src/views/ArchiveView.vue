<script setup lang="ts">
/**
 * 生涯档案（模块 A 主视图）：
 * - 顶部：基础信息（姓名/头衔/联系方式/简介）就地编辑 + 归档统计
 * - 中区：日记 / 成就 / 里程碑 录入表单 + 列表（A1）
 * - 下区：聚合名片（A2/A4）—— 标签云 + 技能 + 经历/教育/项目 + 生涯时间线
 */
import type { JournalEntry, JournalEntryType } from '@pa/shared'
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useCollectionsStore } from '@/stores/collections'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
const poolStore = useCollectionsStore()

/* ── 录入表单（A1，支持新建 / 编辑）── */
const entryType = ref<JournalEntryType>('journal')
const entryTitle = ref('')
const entryContent = ref('')
const entryDate = ref(new Date().toISOString().slice(0, 10))
const entryTags = ref('')
const entryCollection = ref<string | ''>('')
/** 正在编辑的条目 id（null = 新建） */
const editingId = ref<string | null>(null)
const editingTitle = computed(() =>
  editingId.value ? '编辑记录' : `保存${TYPE_META[entryType.value].label}`,
)

const TYPE_META: Record<JournalEntryType, { label: string; desc: string }> = {
  journal: { label: '日记', desc: '日常进展、灵感、学习记录' },
  achievement: { label: '成就', desc: '可写进简历的亮点成果' },
  milestone: { label: '里程碑', desc: '证书、晋级、关键节点' },
}

function submitEntry(): void {
  const title = entryTitle.value.trim()
  const content = entryContent.value.trim()
  if (!title && !content) return
  const draft = {
    entry_type: entryType.value,
    title: title || '未命名记录',
    content_md: content,
    occurred_at: entryDate.value,
    tags: entryTags.value
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean),
    collection_id: entryCollection.value || undefined,
  }
  if (editingId.value) {
    store.updateJournalEntry(editingId.value, draft)
    editingId.value = null
  } else {
    store.addJournalEntry(draft)
  }
  resetEntryForm()
}

function resetEntryForm(): void {
  entryTitle.value = ''
  entryContent.value = ''
  entryTags.value = ''
  entryDate.value = new Date().toISOString().slice(0, 10)
  entryCollection.value = ''
  editingId.value = null
}

/** 点击"编辑"：把条目填入表单，进入编辑模式 */
function startEdit(entry: JournalEntry): void {
  editingId.value = entry.id
  entryType.value = entry.entry_type
  entryTitle.value = entry.title
  entryContent.value = entry.content_md
  entryDate.value = entry.occurred_at
  entryTags.value = entry.tags.join(', ')
  entryCollection.value = entry.collection_id ?? ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/* ── 池子筛选 ── */
type PoolFilter = 'all' | 'none' | string
const poolFilter = ref<PoolFilter>('all')
const filteredJournal = computed(() => {
  if (poolFilter.value === 'all') return store.profile.journal
  if (poolFilter.value === 'none') {
    return store.profile.journal.filter((e) => !e.collection_id)
  }
  return store.profile.journal.filter((e) => e.collection_id === poolFilter.value)
})

/* ── 池子管理 ── */
const showPools = ref(false)
const newPoolName = ref('')
const poolError = ref('')

function addPool(): void {
  if (!newPoolName.value.trim()) return
  try {
    poolStore.addCollection(newPoolName.value)
    newPoolName.value = ''
    poolError.value = ''
  } catch {
    poolError.value = '保存失败：本地存储不可用'
  }
}

function renamePool(id: string): void {
  const name = window.prompt('重命名池子', poolStore.nameOf(id))
  if (!name?.trim()) return
  try {
    poolStore.renameCollection(id, name.trim())
  } catch {
    poolError.value = '保存失败：本地存储不可用'
  }
}

function removePool(id: string): void {
  const name = poolStore.nameOf(id)
  if (!window.confirm(`删除池子「${name}」？其下记录会回到「未分类」。`)) return
  try {
    poolStore.removeCollection(id)
    // 清理归属（逐条更新；池子已删，失败仅影响展示回"未分类"）
    const entriesToClear = store.profile.journal.filter((e) => e.collection_id === id)
    for (const e of entriesToClear) {
      store.updateJournalEntry(e.id, { collection_id: undefined })
    }
    if (poolFilter.value === id) poolFilter.value = 'all'
  } catch {
    poolError.value = '保存失败：本地存储不可用'
  }
}

/* ── 时间线（A4）── */
const activeKind = ref<'all' | 'experience' | 'education' | 'milestone' | 'project'>('all')
const timeline = computed(() => {
  const items = store.careerCard.timeline
  return activeKind.value === 'all' ? items : items.filter((t) => t.kind === activeKind.value)
})

const KIND_STYLE: Record<string, string> = {
  experience: 'border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.08)] text-[#38bdf8]',
  education: 'border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] text-[#a78bfa]',
  milestone: 'border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.08)] text-[#32f08c]',
  project: 'border-[rgba(96,242,189,0.3)] bg-[rgba(96,242,189,0.08)] text-[#60f2bd]',
}
const KIND_LABEL: Record<string, string> = {
  experience: '经历',
  education: '教育',
  milestone: '里程碑',
  project: '项目',
}

/** 友好日期：YYYY-MM → YYYY 年 M 月；完整日期 → M 月 D 日（兼容 ISO 时间戳/异常值） */
function fmtDate(d: string): string {
  if (!d) return ''
  const datePart = d.slice(0, 10)
  const [y, m, day] = datePart.split('-')
  const my = Number(m)
  const md = Number(day)
  if (!y || Number.isNaN(my)) return datePart // 格式异常：原样截断，避免 "NaN 日"
  return day && !Number.isNaN(md) ? `${my} 月 ${md} 日` : `${y} 年 ${my} 月`
}

/** 技能 → 等级条（1–5） */
function levelBars(level: number | undefined): boolean[] {
  return Array.from({ length: 5 }, (_, i) => (level ?? 0) > i)
}

/** 空档案提示 */
const isEmptyArchive = computed(() => store.isEmpty)
</script>

<template>
  <div class="relative min-h-full">
    <!-- 顶部氛围光（随内容滚动） -->
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-5xl px-6 pb-16">
      <!-- ═══════ 基础信息 ═══════ -->
      <PageHeader
        code="A"
        :title="store.profile.full_name || '未命名档案'"
        :desc="store.profile.headline || '还没有头衔 —— 先写一条记录开始吧'"
      >
        <div class="flex items-center gap-3 text-xs text-[rgba(245,249,254,0.45)]">
          <span class="font-mono">{{ store.careerCard.tagCloud.length }}</span> 个标签
          <span class="text-[rgba(255,255,255,0.12)]">|</span>
          <span class="font-mono">{{ store.careerCard.timeline.length }}</span> 条时间线
          <span class="text-[rgba(255,255,255,0.12)]">|</span>
          <span class="font-mono">{{ store.careerCard.materialCount }}</span> 条素材
        </div>
      </PageHeader>

        <div class="card-glass mt-6 p-5">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.45)]">姓名</span>
              <input
                v-model="store.profile.full_name"
                class="input-trae"
                placeholder="你的名字"
                @change="store.saveBasics({ full_name: store.profile.full_name })"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.45)]">头衔</span>
              <input
                v-model="store.profile.headline"
                class="input-trae"
                placeholder="例如：Web 安全工程师 · 渗透测试"
                @change="store.saveBasics({ headline: store.profile.headline })"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.45)]">邮箱</span>
              <input
                v-model="store.profile.email"
                class="input-trae"
                placeholder="you@example.com"
                @change="store.saveBasics({ email: store.profile.email })"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.45)]">电话</span>
              <input
                v-model="store.profile.phone"
                class="input-trae"
                placeholder="138-0000-0000"
                @change="store.saveBasics({ phone: store.profile.phone })"
              />
            </label>
            <label class="block md:col-span-2">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.45)]">个人简介</span>
              <textarea
                v-model="store.profile.summary"
                class="input-trae h-24 resize-none py-3"
                placeholder="一段话介绍自己，作为名片与简历的 summary"
                @change="store.saveBasics({ summary: store.profile.summary })"
              />
            </label>
          </div>
        </div>

      <!-- ═══════ 日记 / 成就 / 里程碑 录入（A1）═══════ -->
      <section class="mt-2">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="heading-tight text-[16px] tracking-wide text-[#f5f9fe]">随手记录</h2>
          <span class="text-xs text-[rgba(245,249,254,0.35)]">原子化记录 · 可编辑 · AI 提炼的原料</span>
        </div>

        <div class="card-glass p-5">
          <!-- 类型切换 -->
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="(meta, type) in TYPE_META"
              :key="type"
              class="rounded-full border px-3.5 py-1.5 text-[13px] transition-colors"
              :class="
                entryType === type
                  ? 'border-[rgba(50,240,140,0.6)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.05)] text-[rgba(245,249,254,0.6)] hover:text-[#f5f9fe]'
              "
              @click="entryType = type as JournalEntryType"
            >
              {{ meta.label }}
              <span class="ml-1 text-[11px] opacity-60">{{ meta.desc }}</span>
            </button>
          </div>

          <!-- 表单 -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              v-model="entryTitle"
              class="input-trae"
              :placeholder="`${TYPE_META[entryType].label}标题`"
            />
            <input
              v-model="entryTags"
              class="input-trae"
              placeholder="标签（逗号分隔，如：渗透测试, Python）"
            />
          </div>
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input v-model="entryDate" class="input-trae" type="date" />
            <select v-model="entryCollection" class="input-trae appearance-none">
              <option value="">放入池子（可选）</option>
              <option v-for="c in poolStore.collections" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <textarea
            v-model="entryContent"
            class="input-trae mt-3 h-24 resize-none py-3"
            placeholder="写点什么…支持 Markdown"
          />
          <div class="mt-3 flex items-center justify-end gap-2">
            <SecondaryButton v-if="editingId" @click="resetEntryForm">取消编辑</SecondaryButton>
            <PrimaryButton :disabled="!entryTitle.trim() && !entryContent.trim()" @click="submitEntry">
              {{ editingTitle }}
            </PrimaryButton>
          </div>
        </div>

        <!-- 池子筛选 / 管理 -->
        <div class="mt-4 flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-[rgba(245,249,254,0.35)]">池子：</span>
          <button
            class="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
            :class="poolFilter === 'all' ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]' : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'"
            @click="poolFilter = 'all'"
          >
            全部
          </button>
          <button
            class="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
            :class="poolFilter === 'none' ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]' : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'"
            @click="poolFilter = 'none'"
          >
            未分类
          </button>
          <button
            v-for="c in poolStore.collections"
            :key="c.id"
            class="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
            :class="poolFilter === c.id ? 'border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]' : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'"
            @click="poolFilter = c.id"
          >
            {{ c.name }}
          </button>
          <button
            class="ml-auto rounded-full border border-[rgba(50,240,140,0.35)] bg-[rgba(50,240,140,0.06)] px-3 py-0.5 text-[11.5px] font-medium text-[#32f08c]"
            @click="showPools = true"
          >
            ⚙ 管理池子
          </button>
        </div>

        <!-- 记录列表 -->
        <div class="mt-4 space-y-3">
          <div
            v-for="entry in filteredJournal"
            :key="entry.id"
            class="card-glass group p-4 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="rounded-full border px-2 py-0.5 text-[11px]"
                    :class="
                      entry.entry_type === 'achievement'
                        ? 'border-[rgba(50,240,140,0.35)] bg-[rgba(50,240,140,0.08)] text-[#32f08c]'
                        : entry.entry_type === 'milestone'
                          ? 'border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.08)] text-[#a78bfa]'
                          : 'border-[rgba(56,189,248,0.35)] bg-[rgba(56,189,248,0.08)] text-[#38bdf8]'
                    "
                  >
                    {{ TYPE_META[entry.entry_type]?.label ?? '记录' }}
                  </span>
                  <!-- 池子徽章 -->
                  <span
                    v-if="entry.collection_id"
                    class="rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] px-2 py-0.5 text-[10.5px]"
                    :class="poolStore.colorOf(entry.collection_id)"
                  >
                    ▣ {{ poolStore.nameOf(entry.collection_id) }}
                  </span>
                  <span class="heading-tight text-[14.5px] text-[#f5f9fe]">{{ entry.title }}</span>
                  <span class="font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                    {{ fmtDate(entry.occurred_at) }}
                  </span>
                </div>
                <p
                  class="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[rgba(245,249,254,0.6)]"
                >
                  {{ entry.content_md }}
                </p>
                <div v-if="entry.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in entry.tags"
                    :key="tag"
                    class="rounded-md bg-[rgba(50,240,140,0.08)] px-2 py-0.5 text-[11px] text-[#60f2bd]"
                  >
                    #{{ tag }}
                  </span>
                </div>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  class="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-xs text-[rgba(245,249,254,0.5)] hover:border-[rgba(50,240,140,0.4)] hover:text-[#32f08c]"
                  title="编辑这条记录"
                  @click="startEdit(entry)"
                >
                  编辑
                </button>
                <button
                  class="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-xs text-[rgba(245,249,254,0.4)] hover:border-[rgba(248,113,113,0.4)] hover:text-[#f87171]"
                  title="删除这条记录"
                  @click="store.removeJournalEntry(entry.id)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="filteredJournal.length === 0"
            class="card-glass flex flex-col items-center justify-center p-10 text-center"
          >
            <div class="text-3xl opacity-60">📝</div>
            <p class="mt-3 text-sm text-[rgba(245,249,254,0.55)]">
              {{ store.profile.journal.length === 0 ? '还没有任何记录 —— 从今天的工作、学习、成就开始积累' : '当前池子没有记录' }}
            </p>
          </div>
        </div>
      </section>

      <!-- ═══════ 聚合名片（A2）═══════ -->
      <section class="mt-10">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="heading-tight text-[16px] tracking-wide text-[#f5f9fe]">聚合名片</h2>
          <span class="text-xs text-[rgba(245,249,254,0.35)]">由档案实时生成 · 名片页同源</span>
        </div>

        <!-- 技能 -->
        <div v-if="store.profile.skills.length" class="card-glass mb-4 p-5">
          <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">技能</div>
          <div class="flex flex-wrap gap-x-6 gap-y-3">
            <div v-for="skill in store.profile.skills" :key="skill.id" class="min-w-[130px]">
              <div class="flex items-center justify-between text-[13px]">
                <span class="text-[rgba(245,249,254,0.85)]">{{ skill.name }}</span>
                <span
                  v-if="skill.category"
                  class="ml-2 rounded px-1.5 py-0.5 text-[10px] text-[rgba(245,249,254,0.4)]"
                >
                  {{ skill.category }}
                </span>
              </div>
              <div v-if="skill.level" class="mt-1 flex gap-1">
                <span
                  v-for="(on, i) in levelBars(skill.level)"
                  :key="i"
                  class="h-1 w-5 rounded-full"
                  :class="on ? 'bg-[#32f08c]' : 'bg-[rgba(255,255,255,0.12)]'"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 标签云 -->
        <div v-if="store.careerCard.tagCloud.length" class="card-glass mb-4 p-5">
          <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">标签云</div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="t in store.careerCard.tagCloud"
              :key="t.name"
              class="rounded-full border border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.05)] px-3 py-1 text-[12px] text-[#60f2bd]"
            >
              #{{ t.name }}
              <span class="ml-1 font-mono text-[10px] opacity-60">{{ t.count }}</span>
            </span>
          </div>
        </div>

        <!-- 经历 / 教育 / 项目 -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div v-if="store.profile.experiences.length" class="card-glass p-5">
            <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">经历</div>
            <div v-for="exp in store.profile.experiences" :key="exp.id" class="mb-4 last:mb-0">
              <div class="text-[13.5px] font-medium text-[#f5f9fe]">{{ exp.role }}</div>
              <div class="text-[12px] text-[rgba(245,249,254,0.45)]">
                {{ exp.company }} · {{ fmtDate(exp.start_date ?? '') }}{{ exp.end_date ? ` — ${fmtDate(exp.end_date)}` : ' — 至今' }}
              </div>
              <p class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                {{ exp.description_md }}
              </p>
            </div>
          </div>

          <div v-if="store.profile.education.length" class="card-glass p-5">
            <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">教育</div>
            <div v-for="edu in store.profile.education" :key="edu.id" class="mb-4 last:mb-0">
              <div class="text-[13.5px] font-medium text-[#f5f9fe]">{{ edu.school }}</div>
              <div class="text-[12px] text-[rgba(245,249,254,0.45)]">
                {{ [edu.degree, edu.major].filter(Boolean).join(' · ') }}
              </div>
              <p v-if="edu.description" class="mt-1 text-[12.5px] text-[rgba(245,249,254,0.55)]">
                {{ edu.description }}
              </p>
            </div>
          </div>

          <div v-if="store.profile.projects.length" class="card-glass p-5">
            <div class="mb-3 text-[13px] font-semibold text-[#f5f9fe]">项目</div>
            <div v-for="proj in store.profile.projects" :key="proj.id" class="mb-4 last:mb-0">
              <div class="text-[13.5px] font-medium text-[#f5f9fe]">{{ proj.name }}</div>
              <p class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                {{ proj.description_md }}
              </p>
            </div>
          </div>
        </div>

        <!-- 生涯时间线（A4） -->
        <div class="card-glass mt-4 p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="text-[13px] font-semibold text-[#f5f9fe]">生涯时间线</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="kind in ['all', 'experience', 'education', 'milestone', 'project']"
                :key="kind"
                class="rounded-full border px-2.5 py-1 text-[11.5px] transition-colors"
                :class="
                  activeKind === kind
                    ? 'border-[rgba(50,240,140,0.6)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]'
                    : 'border-[rgba(255,255,255,0.1)] text-[rgba(245,249,254,0.5)] hover:text-[#f5f9fe]'
                "
                @click="activeKind = kind as typeof activeKind"
              >
                {{ kind === 'all' ? '全部' : KIND_LABEL[kind] }}
              </button>
            </div>
          </div>

          <div class="relative space-y-0 border-l border-[rgba(50,240,140,0.2)] pl-6">
            <div v-for="(item, i) in timeline" :key="`${item.kind}-${item.date}-${item.title}-${i}`" class="relative pb-6 last:pb-0">
              <span
                class="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0a0b0d]"
                :class="
                  item.kind === 'experience'
                    ? 'bg-[#38bdf8]'
                    : item.kind === 'education'
                      ? 'bg-[#a78bfa]'
                      : item.kind === 'milestone'
                        ? 'bg-[#32f08c]'
                        : 'bg-[#60f2bd]'
                "
              />
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full border px-2 py-0.5 text-[10.5px]"
                  :class="KIND_STYLE[item.kind] ?? ''"
                >
                  {{ KIND_LABEL[item.kind] ?? item.kind }}
                </span>
                <span class="heading-tight text-[13.5px] text-[#f5f9fe]">{{ item.title }}</span>
                <span v-if="item.subtitle" class="text-[12px] text-[rgba(245,249,254,0.4)]">
                  {{ item.subtitle }}
                </span>
                <span class="ml-auto font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                  {{ fmtDate(item.date) }}
                </span>
              </div>
              <p v-if="item.snippet" class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                {{ item.snippet }}
              </p>
            </div>

            <div
              v-if="timeline.length === 0"
              class="border-l-0 py-6 text-center text-sm text-[rgba(245,249,254,0.4)]"
            >
              该类型下暂无条目
            </div>
          </div>
        </div>
      </section>

      <!-- 底部操作 -->
      <div class="mt-8 flex justify-end gap-3">
        <SecondaryButton @click="store.resetToDemo()">重置为示例数据</SecondaryButton>
        <SecondaryButton @click="store.resetEmpty()">清空档案</SecondaryButton>
      </div>
    </div>

    <!-- 池子管理 -->
    <Modal v-if="showPools" title="管理池子" max-width="max-w-md" @close="showPools = false">
      <div class="space-y-4">
        <p class="text-[12px] leading-relaxed text-[rgba(245,249,254,0.45)]">
          池子把原子笔记归类存放，如「项目实习」「学校经历」「技术栈」。录入记录时可选择归属，也可在列表筛选。
        </p>

        <!-- 新建 -->
        <div class="flex gap-2">
          <input
            v-model="newPoolName"
            class="input-trae h-9 text-[12.5px]"
            placeholder="新建池子，如：证书 / 开源项目…"
            @keydown.enter="addPool"
          />
          <PrimaryButton :disabled="!newPoolName.trim()" @click="addPool">新建</PrimaryButton>
        </div>

        <!-- 列表 -->
        <div class="space-y-2">
          <div
            v-for="c in poolStore.collections"
            :key="c.id"
            class="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(237,239,242,0.03)] px-3 py-2"
          >
            <span class="text-[13px] font-medium" :class="c.color">{{ c.name }}</span>
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10.5px] text-[rgba(245,249,254,0.3)]">
                {{ store.profile.journal.filter((e) => e.collection_id === c.id).length }} 条
              </span>
              <button class="text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#32f08c]" @click="renamePool(c.id)">
                重命名
              </button>
              <button class="text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]" @click="removePool(c.id)">
                删除
              </button>
            </div>
          </div>
          <div v-if="!poolStore.collections.length" class="py-4 text-center text-[12px] text-[rgba(245,249,254,0.3)]">
            还没有池子，上方新建一个
          </div>
        </div>

        <div v-if="poolError" class="text-[12px] text-[#f87171]">{{ poolError }}</div>
      </div>
    </Modal>
  </div>
</template>
