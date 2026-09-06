<script setup lang="ts">
defineProps<{
  value: number | string
}>()
</script>

<template>
  <span class="count-badge">{{ value }}</span>
</template>

<style scoped>
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.15rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--color-bg-secondary, #f3f3f3);
  color: var(--color-text-muted, #666);
  font-size: 0.75rem;
  line-height: 1.2;
  vertical-align: middle;
}
</style>
