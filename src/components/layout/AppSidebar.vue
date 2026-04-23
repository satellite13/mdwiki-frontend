<script setup lang="ts">
import { computed } from 'vue'
import DocumentTree from '@/components/tree/DocumentTree.vue'

const props = defineProps<{
  width: number
}>()

const sidebarStyle = computed(() => ({
  width: `${props.width}px`
}))
</script>

<template>
  <aside class="sidebar" :style="sidebarStyle">
    <DocumentTree />
  </aside>
</template>

<style scoped>
.sidebar {
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  height: calc(100vh - 48px);
  overflow: hidden;
}
</style>
