<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import SecondaryButton from '@/components/SecondaryButton.vue'

/** 通用模块占位页：读路由 meta 显示模块代号与里程碑，功能在 M1–M5 阶段实现 */
const route = useRoute()
const router = useRouter()
const code = (route.meta.code as string) ?? '—'
const milestone = (route.meta.milestone as string) ?? 'M1–M5'
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16">
    <div class="card-glass p-10 text-center">
      <div
        class="font-mono-data mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(50,240,140,0.3)] bg-[rgba(50,240,140,0.08)] text-2xl font-bold text-[#32f08c]"
      >
        {{ code }}
      </div>

      <h1 class="heading-tight mt-6 text-2xl tracking-wide text-[#f5f9fe]">
        {{ route.meta.title }}
      </h1>

      <div class="mt-4">
        <span
          class="rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-3 py-1 font-mono text-xs text-[#32f08c]"
        >
          里程碑 {{ milestone }} 实现
        </span>
      </div>

      <p class="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[rgba(245,249,254,0.55)]">
        该功能模块的入口已预留，功能将在后续里程碑阶段落地。
        当前为 UI 预览版，专注界面与交互骨架。
      </p>

      <div class="mt-8 flex justify-center gap-3">
        <SecondaryButton @click="router.push('/')">返回主控台</SecondaryButton>
      </div>
    </div>
  </div>
</template>
