<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'

/**
 * 桌面应用壳：左侧固定导航 + 右侧（顶栏 + 内容滚动区）。
 * 无边框窗口拖拽区与窗口控制按钮在 AppTopbar 上（仅桌面版）。
 * 经典黑白：纯白底，无装饰背景层。
 */
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-white text-neutral-900">
    <!-- 左侧导航 -->
    <AppSidebar />

    <!-- 右侧：顶栏 + 内容滚动区 -->
    <div class="relative z-1 flex min-w-0 flex-1 flex-col">
      <AppTopbar />
      <main class="flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>
