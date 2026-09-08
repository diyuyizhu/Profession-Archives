<script setup lang="ts">
/**
 * 页面头部（标题 + 副题）—— 各功能视图共用，右侧 slot 放操作按钮。
 * 传入 back-to 时显示返回按钮（二级页面用）。
 */
import { useRouter } from 'vue-router'

defineProps<{
  /** 模块代号（历史兼容，不再展示徽章） */
  code?: string
  title: string
  desc?: string
  /** 返回目标路径；有值时显示返回按钮 */
  backTo?: string
}>()

const router = useRouter()
</script>

<template>
  <section class="flex flex-wrap items-end justify-between gap-4 py-8">
    <div>
      <button
        v-if="backTo"
        class="mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-neutral-500 transition-colors hover:text-neutral-900"
        @click="router.push(backTo)"
      >
        <span aria-hidden="true">←</span> 返回
      </button>
      <h1 class="heading-tight text-2xl tracking-wide text-neutral-900">{{ title }}</h1>
      <p v-if="desc" class="mt-1 text-sm text-neutral-500">{{ desc }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </section>
</template>
