<script setup lang="ts">
/**
 * 页面头部（模块徽章 + 标题 + 副题）—— 各功能视图共用，右侧 slot 放操作按钮。
 * 徽章 = 「模块 {code} · {title}」；Home 欢迎区语义不同，不使用本组件。
 */
defineProps<{
  /** 模块代号，如 B1 / C3 / F2 */
  code: string
  title: string
  desc?: string
}>()
</script>

<template>
  <section class="flex flex-wrap items-end justify-between gap-4 py-8">
    <div>
      <div
        class="mb-3 flex w-fit items-center gap-2 rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-3 py-1 text-xs text-[#32f08c]"
      >
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[#32f08c]" />
        模块 {{ code }} · {{ title }}
      </div>
      <h1 class="heading-tight text-2xl tracking-wide text-[#f5f9fe]">{{ title }}</h1>
      <p v-if="desc" class="mt-1 text-sm text-[rgba(245,249,254,0.55)]">{{ desc }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </section>
</template>
