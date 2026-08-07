<script setup lang="ts">
/**
 * 站点字段映射（D4）：按 origin 记忆表单控件 → 档案字段的映射。
 * 插件首次识别不准时用户手动指定，这里的管理界面可增删；插件落地后自动复用。
 */
import type { AutomationControlType, AutomationTargetField, FormMapping } from '@pa/shared'
import {
  AUTOMATION_CONTROL_TYPES,
  AUTOMATION_TARGET_FIELDS,
  AUTOMATION_TARGET_LABELS,
} from '@pa/shared'
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useFormMappingStore } from '@/stores/formMapping'

const store = useFormMappingStore()

const showAdd = ref(false)
const form = ref({
  origin: '',
  field_key: '',
  field_label: '',
  control_type: 'input' as AutomationControlType,
  target_field: 'full_name' as AutomationTargetField,
})

const CONTROL_LABELS: Record<AutomationControlType, string> = {
  input: '输入框',
  select: '下拉',
  textarea: '多行文本',
  file: '文件上传',
}

const groups = computed(() => {
  const map = new Map<string, FormMapping[]>()
  for (const m of store.mappings) {
    const list = map.get(m.origin)
    if (list) list.push(m)
    else map.set(m.origin, [m])
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

function openAdd(): void {
  form.value = {
    origin: groups.value[0]?.[0] ?? '',
    field_key: '',
    field_label: '',
    control_type: 'input',
    target_field: 'full_name',
  }
  showAdd.value = true
}

function saveAdd(): void {
  if (!form.value.origin.trim() || !form.value.field_key.trim()) return
  try {
    store.addMapping({
      origin: form.value.origin.trim(),
      field_key: form.value.field_key.trim(),
      field_label: form.value.field_label.trim() || undefined,
      control_type: form.value.control_type,
      target_field: form.value.target_field,
    })
  } catch {
    window.alert('保存失败：本地存储不可用或已满')
    return
  }
  showAdd.value = false
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-3xl px-6 pb-16">
      <PageHeader code="D4" title="字段映射" desc="按站点记忆表单字段 → 档案字段的对应关系">
        <PrimaryButton @click="openAdd">＋ 新增映射</PrimaryButton>
      </PageHeader>

      <!-- 说明 -->
      <div class="card-glass mb-5 p-4 text-[12px] leading-relaxed text-[rgba(245,249,254,0.45)]">
        <div class="mb-1 font-medium text-[rgba(245,249,254,0.7)]">如何工作</div>
        插件识别官网投递表单时，先用内置规则匹配字段名 / id / label；命中率不足时你在插件 popup 手动指定，
        映射会按站点（origin）记住并同步到这里 —— 下次访问同一站点自动复用。
      </div>

      <!-- 空态 -->
      <div
        v-if="!groups.length"
        class="card-glass flex flex-col items-center justify-center gap-2 px-5 py-14 text-center"
      >
        <span class="text-3xl">🔗</span>
        <div class="text-[13px] text-[rgba(245,249,254,0.6)]">还没有字段映射</div>
        <div class="text-[11.5px] text-[rgba(245,249,254,0.35)]">
          可从插件手动指定后同步，或先手动新增常用站点映射
        </div>
      </div>

      <!-- 按 origin 分组 -->
      <div v-else class="space-y-4">
        <section v-for="[origin, list] in groups" :key="origin" class="card-glass p-5">
          <div class="mb-3 flex items-center justify-between">
            <div class="min-w-0">
              <div class="truncate text-[13.5px] font-semibold text-[#f5f9fe]">{{ origin }}</div>
              <div class="text-[11px] text-[rgba(245,249,254,0.35)]">{{ list.length }} 条映射</div>
            </div>
            <button
              class="shrink-0 text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]"
              @click="store.clearOrigin(origin)"
            >
              清空此站点
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-[rgba(255,255,255,0.08)] text-[11px] text-[rgba(245,249,254,0.4)]">
                  <th class="py-2 pr-3 font-medium">表单控件（name / id）</th>
                  <th class="py-2 pr-3 font-medium">控件类型</th>
                  <th class="py-2 pr-3 font-medium">档案字段</th>
                  <th class="py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in list" :key="m.id" class="border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <td class="py-2.5 pr-3 font-mono text-[12px] text-[#f5f9fe]">
                    {{ m.field_key }}<span v-if="m.field_label" class="ml-1 text-[10.5px] text-[rgba(245,249,254,0.35)]">{{ m.field_label }}</span>
                  </td>
                  <td class="py-2.5 pr-3 text-[12px] text-[rgba(245,249,254,0.5)]">
                    {{ m.control_type ? CONTROL_LABELS[m.control_type] : '—' }}
                  </td>
                  <td class="py-2.5 pr-3">
                    <span class="rounded-full border border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.08)] px-2 py-0.5 text-[11px] text-[#60f2bd]">
                      {{ AUTOMATION_TARGET_LABELS[m.target_field] }}
                    </span>
                  </td>
                  <td class="py-2.5">
                    <button
                      class="text-[11.5px] text-[rgba(245,249,254,0.4)] hover:text-[#f87171]"
                      @click="store.removeMapping(m.id)"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- 新增映射弹窗 -->
      <Modal v-if="showAdd" title="新增字段映射" max-width="max-w-md" @close="showAdd = false">
        <form class="space-y-4" @submit.prevent="saveAdd">
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">站点 Origin *</span>
              <input v-model="form.origin" class="input-trae" list="fm-origins" placeholder="如：https://jobs.example.com" />
              <datalist id="fm-origins">
                <option v-for="o in store.origins" :key="o" :value="o" />
              </datalist>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">表单控件 name / id *</span>
              <input v-model="form.field_key" class="input-trae" placeholder="如：fullname / phone / input-email" />
            </label>
            <div class="grid grid-cols-2 gap-4">
              <label class="block">
                <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">控件标签（可选）</span>
                <input v-model="form.field_label" class="input-trae" placeholder="如：联系电话" />
              </label>
              <label class="block">
                <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">控件类型</span>
                <select v-model="form.control_type" class="input-trae appearance-none">
                  <option v-for="c in AUTOMATION_CONTROL_TYPES" :key="c" :value="c">
                    {{ CONTROL_LABELS[c] }}
                  </option>
                </select>
              </label>
            </div>
            <label class="block">
              <span class="mb-1.5 block text-xs text-[rgba(245,249,254,0.55)]">映射到档案字段</span>
              <select v-model="form.target_field" class="input-trae appearance-none">
                <option v-for="f in AUTOMATION_TARGET_FIELDS" :key="f" :value="f">
                  {{ AUTOMATION_TARGET_LABELS[f] }}
                </option>
              </select>
            </label>

            <div class="flex items-center justify-end gap-3 pt-1">
              <SecondaryButton type="button" @click="showAdd = false">取消</SecondaryButton>
              <PrimaryButton type="submit" :disabled="!form.origin.trim() || !form.field_key.trim()">
                保存映射
              </PrimaryButton>
            </div>
        </form>
      </Modal>
    </div>
  </div>
</template>
