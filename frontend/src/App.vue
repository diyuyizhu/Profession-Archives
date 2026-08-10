<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import PixelBackground from '@/components/PixelBackground.vue'
import WindowTitlebar from '@/components/layout/WindowTitlebar.vue'

/**
 * 桌面应用壳：无边框窗口标题栏（仅桌面版）+ 左侧固定导航 + 右侧（顶栏 + 内容滚动区）。
 * 像素矩阵背景 fixed 在最底层，内容区滚动在上层。
 */
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-[#0a0b0d] text-[#f5f9fe]">
    <!-- 无边框窗口标题栏（Tauri 桌面版；浏览器不渲染） -->
    <WindowTitlebar />

    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      <!-- 像素矩阵背景：fixed 底层，鼠标扫过点亮 -->
      <PixelBackground />

      <!-- 氛围光斑：fixed 视口层，常驻柔和光晕（毛玻璃卡片透出磨砂光感的素材） -->
      <div class="aura-fixed" aria-hidden="true" />

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
  </div>
</template>
