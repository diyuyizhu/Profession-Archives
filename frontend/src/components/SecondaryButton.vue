<script setup lang="ts">
/** 次按钮：白底灰边墨字（btn-secondary-trae，类名历史沿用） */
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
  <button class="btn-secondary-trae" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>
