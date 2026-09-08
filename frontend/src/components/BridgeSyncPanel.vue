<script setup lang="ts">
/**
 * 本地桥同步面板（模块 D）：供「插件配对」页与「投递看板」页复用。
 * - 同步模式切换：直接同步 / 选择数据（排除脏数据）
 * - 选择模式下打开预览弹窗，勾选要保留的条目后确认
 */
import Modal from '@/components/Modal.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useBridgeSyncStore, type BridgeInboxItem } from '@/stores/bridgeSync'

const sync = useBridgeSyncStore()

/** 触发同步：按当前模式走直接合并或打开预览 */
function trigger(): void {
  if (sync.syncMode === 'select') void sync.openPreview()
  else void sync.syncDirect()
}

function itemTitle(it: BridgeInboxItem): string {
  if (it.type === 'job') return `${it.company ?? ''} · ${it.title ?? ''}`
  if (it.type === 'application') return `投递回传 → ${it.status ?? 'applied'}${it.title ? ` · ${it.title}` : ''}`
  if (it.type === 'form-mapping') return `字段映射 · ${it.field_key ?? ''}`
  return it.type
}
</script>

<template>
  <div>
    <!-- 模式切换 + 同步按钮 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex shrink-0 overflow-hidden rounded-lg border border-neutral-300">
        <button
          class="px-3 py-1.5 text-[11.5px] transition-colors"
          :aria-pressed="sync.syncMode === 'direct'"
          :class="sync.syncMode === 'direct' ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'"
          @click="sync.setMode('direct')"
        >
          直接同步
        </button>
        <button
          class="px-3 py-1.5 text-[11.5px] transition-colors"
          :aria-pressed="sync.syncMode === 'select'"
          :class="sync.syncMode === 'select' ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'"
          @click="sync.setMode('select')"
        >
          选择数据
        </button>
      </div>
      <PrimaryButton :disabled="sync.syncing" @click="trigger">
        {{ sync.syncing ? '同步中…' : '同步数据' }}
      </PrimaryButton>
    </div>

    <div
      v-if="sync.msg"
      class="mt-3 rounded-lg border px-3 py-2 text-[12px]"
      :class="sync.msg.startsWith('同步失败') || sync.msg.startsWith('拉取失败') ? 'border-red-300 bg-red-50 text-red-600' : 'border-neutral-200 bg-neutral-50 text-neutral-600'"
    >
      {{ sync.msg }}
    </div>

    <!-- 选择模式预览弹窗 -->
    <Modal v-if="sync.showPreview" title="选择要同步的数据" max-width="max-w-lg" @close="sync.closePreview">
      <div class="space-y-3">
        <div class="flex items-center justify-between text-[12px] text-neutral-500">
          <span>已勾选 {{ sync.selectedIds.size }}/{{ sync.inboxItems.length }} 条</span>
          <button class="text-[11.5px] text-neutral-400 hover:text-neutral-900" @click="sync.inboxItems.length === sync.selectedIds.size ? sync.clearSelection() : sync.selectAll()">
            {{ sync.inboxItems.length === sync.selectedIds.size ? '全不选' : '全选' }}
          </button>
        </div>

        <div class="max-h-[50vh] space-y-1.5 overflow-y-auto">
          <label
            v-for="(it, i) in sync.inboxItems"
            :key="sync.itemKey(it, i)"
            class="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors"
            :class="sync.selectedIds.has(sync.itemKey(it, i)) ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200 bg-neutral-50'"
          >
            <input
              type="checkbox"
              class="mt-0.5"
              :checked="sync.selectedIds.has(sync.itemKey(it, i))"
              @change="sync.toggleSelect(sync.itemKey(it, i))"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-[12.5px] text-neutral-900">{{ itemTitle(it) }}</div>
              <div class="mt-0.5 truncate text-[11px] text-neutral-400">
                {{ it.type === 'job' ? (it.url ?? '') : it.type === 'application' ? (it.note ?? '') : (it.target_field ?? '') }}
              </div>
            </div>
          </label>
        </div>

        <div class="flex items-center justify-end gap-3 pt-1">
          <SecondaryButton @click="sync.closePreview">取消</SecondaryButton>
          <PrimaryButton :disabled="!sync.selectedIds.size || sync.syncing" @click="sync.confirmSelected">
            {{ sync.syncing ? '同步中…' : `同步 ${sync.selectedIds.size} 条` }}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  </div>
</template>
