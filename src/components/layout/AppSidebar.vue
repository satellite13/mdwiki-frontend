<script setup lang="ts">
import DocumentTree from '@/components/tree/DocumentTree.vue'
</script>

<template>
  <aside class="sidebar">
    <DocumentTree />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  height: calc(100vh - 48px);
  overflow: hidden;
}
</style>
