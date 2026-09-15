<script setup lang="ts">
/**
 * 内置字段单元格：显示 + 就地编辑（表格视图用）。
 *
 * 与 PropertyCell（自定义属性）分工：这里负责 Application 自身的固定字段。
 * 这些字段被其它功能依赖（漏斗、插件回传、导入、特化简历），因此**不可删除**，
 * 但允许为空、允许在列表里隐藏（显隐由「列管理」控制）。
 *
 * 写入路径：
 * - 普通字段 → store.updateApplication
 * - 看板列(status) → store.transition（走事件日志与漏斗口径）
 * - 标签/分组 → 数组增删后整体写回
 * - 更新时间(updated_at) → 只读
 */
import type { Application, ApplicationPayload, ApplyMethod } from '@pa/shared'
import { APPLY_METHOD_LABELS, APPLY_METHODS } from '@pa/shared'
import { statusMeta } from '@pa/shared/application'
import type { ResolvedField } from '@pa/shared/property'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useApplicationStore } from '@/stores/application'

const props = defineProps<{ app: Application; field: ResolvedField }>()
const store = useApplicationStore()

const key = computed(() => props.field.key)
/** 只读字段（系统维护） */
const readonly = computed(() => key.value === 'updated_at')
/** 文本类字段（就地输入框） */
const TEXT_KEYS = ['title', 'company', 'channel', 'reject_reason', 'url', 'notes']
const isText = computed(() => TEXT_KEYS.includes(key.value))
/** 清空时写 undefined 而不是空串（可选字段） */
const OPTIONAL_KEYS = ['channel', 'url', 'reject_reason', 'applied_at', 'apply_method']

const root = ref<HTMLElement | null>(null)
const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const tagsOpen = ref(false)
const tagDraft = ref('')

const textValue = computed(() => {
  const v = (props.app as unknown as Record<string, unknown>)[key.value]
  return v === undefined || v === null ? '' : String(v)
})

const tagValues = computed<string[]>(() =>
  key.value === 'tags' ? (props.app.tags ?? []) : (props.app.groups ?? []),
)

const displayText = computed(() => {
  switch (key.value) {
    case 'apply_method':
      return props.app.apply_method ? (APPLY_METHOD_LABELS[props.app.apply_method] ?? '—') : '—'
    case 'updated_at':
      return props.app.updated_at ? props.app.updated_at.slice(0, 10) : '—'
    default:
      return textValue.value || '—'
  }
})

const textClass = computed(() =>
  key.value === 'title'
    ? 'truncate text-[12.5px] font-medium text-neutral-900'
    : 'truncate text-[12px] text-neutral-500',
)

function patchField(value: unknown): void {
  store.updateApplication(props.app.id, {
    [key.value]: value,
  } as Partial<Omit<ApplicationPayload, 'status'>>)
}

async function startEdit(): Promise<void> {
  if (readonly.value || !isText.value) return
  draft.value = textValue.value
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select?.()
}

function commitText(): void {
  if (!editing.value) return
  editing.value = false
  const raw = draft.value.trim()
  patchField(raw || (OPTIONAL_KEYS.includes(key.value) ? undefined : ''))
}

function cancel(): void {
  editing.value = false
  tagsOpen.value = false
}

/* 标签 / 分组：就地增删 */
function openTags(): void {
  if (readonly.value) return
  tagsOpen.value = true
  tagDraft.value = ''
}

function addTag(): void {
  const t = tagDraft.value.trim()
  if (!t) return
  patchField([...new Set([...tagValues.value, t])])
  tagDraft.value = ''
}

function removeTag(t: string): void {
  patchField(tagValues.value.filter((x) => x !== t))
}

/* 弹层点击外部关闭（只在打开期间挂监听，避免每个单元格常驻） */
function onDocPointerDown(e: PointerEvent): void {
  if (!root.value?.contains(e.target as Node)) tagsOpen.value = false
}
watch(tagsOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onDocPointerDown, true)
  else document.removeEventListener('pointerdown', onDocPointerDown, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown, true))
</script>

<template>
  <div ref="root" class="min-w-0">
    <!-- 看板列：芯片样式下拉，迁移走 transition（记事件日志） -->
    <select
      v-if="key === 'status'"
      class="max-w-full cursor-pointer rounded-full border px-2 py-0.5 text-[10.5px] outline-none"
      :class="[statusMeta(app.status).chip, statusMeta(app.status).text]"
      :value="app.status"
      title="移动到其他看板列"
      @click.stop
      @change="store.transition(app.id, ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="c in store.resolvedColumns" :key="c.id" :value="c.id">{{ c.name }}</option>
    </select>

    <!-- 投递方式 -->
    <select
      v-else-if="key === 'apply_method'"
      class="w-full rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[12px] text-neutral-600 hover:border-neutral-300"
      :value="app.apply_method ?? ''"
      @click.stop
      @change="patchField(($event.target as HTMLSelectElement).value || undefined)"
    >
      <option value="">—</option>
      <option v-for="m in APPLY_METHODS" :key="m" :value="m">{{ APPLY_METHOD_LABELS[m] }}</option>
    </select>

    <!-- 重要性 -->
    <select
      v-else-if="key === 'importance'"
      class="rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[11.5px] text-neutral-600 hover:border-neutral-300"
      :value="app.importance ?? ''"
      @click.stop
      @change="patchField(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
    >
      <option value="">—</option>
      <option v-for="n in 5" :key="n" :value="String(n)">{{ '★'.repeat(n) }}</option>
    </select>

    <!-- 预期轮数 -->
    <select
      v-else-if="key === 'total_rounds'"
      class="rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[11.5px] text-neutral-600 hover:border-neutral-300"
      :value="app.total_rounds ?? ''"
      @click.stop
      @change="patchField(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
    >
      <option value="">—</option>
      <option v-for="n in 8" :key="n" :value="String(n)">{{ n }} 轮</option>
    </select>

    <!-- 投递日期 -->
    <input
      v-else-if="key === 'applied_at'"
      type="date"
      class="rounded border border-transparent bg-transparent px-0.5 py-0.5 font-mono text-[11.5px] text-neutral-500 hover:border-neutral-300 focus:border-neutral-900 focus:outline-none"
      :value="app.applied_at ?? ''"
      @click.stop
      @change="patchField(($event.target as HTMLInputElement).value || undefined)"
    />

    <!-- 标签 / 分组：就地增删 -->
    <div v-else-if="key === 'tags' || key === 'groups'" class="relative" @click.stop>
      <div class="flex flex-wrap items-center gap-1" @click="openTags">
        <span
          v-for="t in tagValues"
          :key="t"
          class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600"
        >
          {{ key === 'tags' ? '#' : '' }}{{ t }}
        </span>
        <span v-if="!tagValues.length" class="text-[12px] text-neutral-300">为空</span>
      </div>
      <div
        v-if="tagsOpen"
        class="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm"
      >
        <div class="mb-1.5 flex flex-wrap gap-1">
          <button
            v-for="t in tagValues"
            :key="t"
            class="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10.5px] text-neutral-600 transition-colors hover:border-red-400 hover:text-red-600"
            title="点击移除"
            @click="removeTag(t)"
          >
            {{ t }} ✕
          </button>
          <span v-if="!tagValues.length" class="text-[11px] text-neutral-300">还没有</span>
        </div>
        <input
          v-model="tagDraft"
          class="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-[11.5px]"
          placeholder="输入后回车添加"
          @keydown.enter="addTag"
          @keydown.esc="cancel"
        />
      </div>
    </div>

    <!-- 文本类字段：就地输入 -->
    <input
      v-else-if="editing"
      ref="inputEl"
      v-model="draft"
      :type="key === 'url' ? 'url' : 'text'"
      class="w-full rounded border border-neutral-900 bg-white px-1.5 py-0.5 text-[12.5px] outline-none"
      @click.stop
      @keydown.enter="commitText"
      @keydown.esc="cancel"
      @blur="commitText"
    />

    <!-- 只读 / 只读展示 -->
    <div
      class="truncate"
      :class="[textClass, readonly ? '' : 'cursor-text']"
      :title="displayText"
      @click.stop="startEdit"
    >
      {{ displayText }}
    </div>
  </div>
</template>
