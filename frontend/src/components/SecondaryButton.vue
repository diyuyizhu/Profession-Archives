<script setup lang="ts">
/** 次按钮：半透明白底 + 白边框，focus 薄荷绿描边 */
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
