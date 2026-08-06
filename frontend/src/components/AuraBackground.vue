<script setup lang="ts">
/**
 * 深色氛围光晕层：大范围椭圆径向渐变（青蓝/紫），随内容滚动（放滚动容器内）。
 * 也可作为 CTA 中心微光复用（variant="cta"）。
 */
withDefaults(
  defineProps<{
    /** 默认顶部氛围光；cta = 底部 CTA 中心微光 */
    variant?: 'top' | 'cta'
  }>(),
  {
    variant: 'top',
  },
)
</script>

<template>
  <div :class="variant === 'top' ? 'aura-layer' : 'aura-cta'" aria-hidden="true" />
</template>
