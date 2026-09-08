<script setup lang="ts">
/**
 * 通用对话框：role=dialog + aria-modal、Escape 关闭、焦点陷阱、背景滚动锁定、焦点进入/还原、遮罩点击关闭。
 * 内容走默认 slot；底部操作区由调用方自行布局。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(defineProps<{ title: string; maxWidth?: string }>(), {
  maxWidth: 'max-w-lg',
})

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

function getFocusable(): HTMLElement[] {
  if (!panel.value) return []
  return [
    ...panel.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !(el as HTMLButtonElement).disabled)
}

function focusFirst(): void {
  const first = getFocusable()[0]
  first?.focus()
}

/** Tab / Shift+Tab 焦点陷阱：在对话框内循环，不逃逸到背景 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const els = getFocusable()
  if (!els.length) return
  const first = els[0]!
  const last = els[els.length - 1]!
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && (active === first || !panel.value?.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !panel.value?.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  document.body.style.overflow = 'hidden' // 锁定背景滚动
  focusFirst()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  previousFocus?.focus()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.4)] p-4"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="card-glass max-h-[92vh] w-full overflow-y-auto p-6"
      :class="maxWidth"
    >
      <div class="mb-5 flex items-center justify-between">
        <h3 class="heading-tight text-[16px] tracking-wide text-neutral-900">{{ title }}</h3>
        <button
          class="text-neutral-400 transition-colors hover:text-neutral-900"
          aria-label="关闭"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>
