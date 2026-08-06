<script setup lang="ts">
/** 主按钮：薄荷绿渐变底 + 近黑字 + 光晕阴影，hover 提亮 */
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  {
    type: 'button',
    disabled: false,
  },
)
</script>

<template>
  <button class="btn-primary-trae" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>
