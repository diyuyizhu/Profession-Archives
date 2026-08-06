<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { PixelMatrix } from '@/composables/usePixelMatrix'

/**
 * 像素矩阵背景：fixed 视口底层 canvas。
 * 像素默认近黑 + 浅色网格线；鼠标扫过像素点亮薄荷绿并衰减（尾迹）。
 * 注意：canvas 本身 pointer-events:none（不挡内容），
 * 鼠标事件挂 window，全视口范围都能触发点亮。
 */
const canvasRef = ref<HTMLCanvasElement | null>(null)
let matrix: PixelMatrix | null = null

function onMove(e: MouseEvent) {
  matrix?.onMouseMove(e)
}
function onLeave() {
  matrix?.onMouseLeave()
}

onMounted(() => {
  if (!canvasRef.value) return
  matrix = new PixelMatrix(canvasRef.value, { interactive: true })
  matrix.start()
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseleave', onLeave)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseleave', onLeave)
  matrix?.destroy()
})
</script>

<template>
  <canvas ref="canvasRef" class="pixel-canvas" aria-hidden="true" />
</template>

<style scoped>
.pixel-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
