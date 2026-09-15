<script setup lang="ts">
/**
 * 属性单元格：渲染 + 就地编辑（多维表格 / 记录页共用）。
 * - 只编辑「自定义属性」；内置字段（公司/岗位/渠道…）在表格里只读，改走上方的编辑弹窗
 * - text / number / date 用原生输入框，Enter 或失焦提交，Esc 取消
 * - select 用原生下拉；multi_select 用选项开关（无选项时退化为逗号分隔输入）
 * - checkbox 直接点击切换
 */
import type { PropertyValue } from '@pa/shared'
import type { ResolvedField } from '@pa/shared/property'
import { formatValue } from '@pa/shared/property'
import { computed, nextTick, ref } from 'vue'

const props = defineProps<{ field: ResolvedField; value: PropertyValue }>()
const emit = defineEmits<{ update: [value: PropertyValue] }>()

const editing = ref(false)
const draft = ref('')
const multiOpen = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

const editable = computed(() => props.field.custom)
const options = computed(() => props.field.options ?? [])
const values = computed<string[]>(() => {
  const v = props.value
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
})

async function startEdit(): Promise<void> {
  if (!editable.value) return
  if (props.field.kind === 'boolean') {
    emit('update', props.value !== true)
    return
  }
  if (props.field.kind === 'tags' && options.value.length) {
    multiOpen.value = true
    return
  }
  draft.value =
    props.value === undefined || props.value === null || Array.isArray(props.value)
      ? Array.isArray(props.value)
        ? props.value.join(', ')
        : ''
      : String(props.value)
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select?.()
}

function commit(): void {
  if (!editing.value) return
  editing.value = false
  const raw = draft.value.trim()
  if (props.field.kind === 'number') {
    if (!raw) return emit('update', null)
    const n = Number(raw)
    return emit('update', Number.isNaN(n) ? null : n)
  }
  if (props.field.kind === 'tags') {
    const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
    return emit('update', list)
  }
  emit('update', raw || null)
}

function cancel(): void {
  editing.value = false
  multiOpen.value = false
}

function toggleMulti(v: string): void {
  const next = values.value.includes(v) ? values.value.filter((x) => x !== v) : [...values.value, v]
  emit('update', next)
}

function display(): string {
  if (props.field.kind === 'boolean') return props.value === true ? '☑' : '☐'
  return formatValue(props.value, props.field.kind)
}
</script>

<template>
  <div class="min-w-0">
    <!-- 勾选框：单击切换 -->
    <button
      v-if="field.kind === 'boolean'"
      class="w-full text-left text-[15px] leading-none"
      :class="value === true ? 'text-neutral-900' : 'text-neutral-300'"
      :title="editable ? '点击切换' : '只读'"
      @click.stop="startEdit"
    >
      {{ display() }}
    </button>

    <!-- 编辑态：文本 / 数字 / 日期 -->
    <input
      v-else-if="editing"
      ref="inputEl"
      v-model="draft"
      :type="field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'"
      class="w-full rounded border border-neutral-900 bg-white px-1.5 py-0.5 text-[12.5px] outline-none"
      @click.stop
      @keydown.enter="commit"
      @keydown.esc="cancel"
      @blur="commit"
    />

    <!-- 多选：选项开关面板 -->
    <div v-else-if="multiOpen" class="relative" @click.stop>
      <div class="absolute left-0 top-0 z-20 w-44 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-sm">
        <label
          v-for="opt in options"
          :key="opt.id"
          class="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[12px] hover:bg-neutral-50"
        >
          <input
            type="checkbox"
            class="h-3.5 w-3.5 accent-neutral-900"
            :checked="values.includes(opt.name)"
            @change="toggleMulti(opt.name)"
          />
          <span class="truncate">{{ opt.name }}</span>
        </label>
        <button class="mt-1 w-full rounded px-1.5 py-1 text-left text-[11.5px] text-neutral-400 hover:text-neutral-900" @click="cancel">
          收起
        </button>
      </div>
      <span class="text-[12.5px] text-neutral-400">…</span>
    </div>

    <!-- 单选：原生下拉 -->
    <select
      v-else-if="field.kind === 'column' && editable && options.length"
      class="w-full rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[12.5px] hover:border-neutral-300"
      :value="typeof value === 'string' ? value : ''"
      @click.stop
      @change="emit('update', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">—</option>
      <option v-for="opt in options" :key="opt.id" :value="opt.name">{{ opt.name }}</option>
    </select>

    <!-- 多选（带选项）：标签展示 -->
    <div v-else-if="field.kind === 'tags' && options.length" class="flex flex-wrap gap-1" @click.stop="startEdit">
      <span
        v-for="v in values"
        :key="v"
        class="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10.5px] text-neutral-600"
      >
        {{ v }}
      </span>
      <span v-if="!values.length" class="text-[12px] text-neutral-300">为空</span>
    </div>

    <!-- 只读展示 -->
    <div
      class="truncate text-[12.5px]"
      :class="display() ? 'text-neutral-700' : 'text-neutral-300'"
      :title="display()"
      @click.stop="startEdit"
    >
      <template v-if="display()">{{ display() }}</template>
      <template v-else>为空</template>
    </div>
  </div>
</template>
