<script setup lang="ts">
/** 主按钮：墨黑底 + 白字（btn-primary-trae，类名历史沿用） */
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
