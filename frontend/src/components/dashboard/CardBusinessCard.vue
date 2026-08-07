<script setup lang="ts">
/**
 * 仪表盘 · 个人名片预览：姓名/头衔/邮箱/电话/顶部标签 + 查看完整名片。
 */
import { computed } from 'vue'

import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()
const profile = computed(() => profileStore.profile)
const card = computed(() => profileStore.careerCard)

const topTags = computed(() => card.value.tagCloud.slice(0, 3).map((t) => t.name))
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-4">
    <div class="flex items-center gap-4">
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-2xl font-bold text-[#32f08c]"
      >
        {{ (profile.full_name || '?').slice(0, 1) }}
      </div>
      <div class="min-w-0">
        <div class="heading-tight truncate text-[17px] text-[#f5f9fe]">
          {{ profile.full_name || '未命名' }}
        </div>
        <div v-if="profile.headline" class="truncate text-[12.5px] text-[#60f2bd]">
          {{ profile.headline }}
        </div>
      </div>
    </div>

    <div v-if="profile.email || profile.phone" class="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[rgba(245,249,254,0.5)]">
      <span v-if="profile.email">✉ {{ profile.email }}</span>
      <span v-if="profile.phone">☎ {{ profile.phone }}</span>
    </div>

    <div v-if="topTags.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="t in topTags"
        :key="t"
        class="rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-2 py-0.5 text-[10.5px] text-[#60f2bd]"
      >
        #{{ t }}
      </span>
    </div>

    <RouterLink to="/card" class="text-[12px] font-medium text-[#32f08c] hover:text-[#60f2bd] no-underline">
      查看完整名片 →
    </RouterLink>
  </div>
</template>
