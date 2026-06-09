<script setup lang="ts">
withDefaults(defineProps<{
  width?: string
  height?: string
  count?: number
  variant?: 'line' | 'circle' | 'block'
}>(), {
  width: '100%',
  height: '16px',
  count: 1,
  variant: 'line'
})
</script>

<template>
  <template v-for="i in count" :key="i">
    <div
      v-if="i > 1"
      class="skeleton-gap"
      :style="{ height: '8px' }"
    />
    <div
      :class="['skeleton', `skeleton--${variant}`]"
      :style="{ width, height }"
      aria-hidden="true"
    />
  </template>
</template>

<style scoped>
.skeleton-gap {
  width: 100%;
}
</style>
