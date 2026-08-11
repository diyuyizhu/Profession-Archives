<script setup lang="ts">
/**
 * 页面头部（标题 + 副题）—— 各功能视图共用，右侧 slot 放操作按钮。
 */
defineProps<{
  /** 模块代号（历史兼容，不再展示徽章） */
  code?: string
  title: string
  desc?: string
}>()
</script>

<template>
  <section class="flex flex-wrap items-end justify-between gap-4 py-8">
    <div>
      <h1 class="heading-tight text-2xl tracking-wide text-[#f5f9fe]">{{ title }}</h1>
      <p v-if="desc" class="mt-1 text-sm text-[rgba(245,249,254,0.55)]">{{ desc }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </section>
</template>
