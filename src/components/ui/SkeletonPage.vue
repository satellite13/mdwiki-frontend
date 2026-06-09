<script setup lang="ts">
import SkeletonLoader from './SkeletonLoader.vue'

withDefaults(defineProps<{
  variant?: 'page' | 'editor' | 'table' | 'search' | 'tree' | 'graph' | 'form'
}>(), {
  variant: 'page'
})
</script>

<template>
  <!-- Page skeleton: title + paragraphs -->
  <div v-if="variant === 'page'" class="skeleton-page" aria-busy="true" aria-label="Loading page">
    <SkeletonLoader width="60%" height="28px" variant="block" />
    <SkeletonLoader width="100%" height="16px" />
    <SkeletonLoader width="92%" height="16px" />
    <SkeletonLoader width="78%" height="16px" />
    <SkeletonLoader width="100%" height="16px" />
    <SkeletonLoader width="45%" height="16px" />
  </div>

  <!-- Editor skeleton: two columns -->
  <div v-else-if="variant === 'editor'" class="skeleton-editor" aria-busy="true" aria-label="Loading editor">
    <div class="skeleton-editor-col">
      <SkeletonLoader width="100%" height="16px" :count="8" />
    </div>
    <div class="skeleton-editor-col">
      <SkeletonLoader width="60%" height="28px" variant="block" />
      <SkeletonLoader width="100%" height="16px" :count="6" />
    </div>
  </div>

  <!-- Table skeleton: header + rows -->
  <div v-else-if="variant === 'table'" class="skeleton-table" aria-busy="true" aria-label="Loading table">
    <SkeletonLoader width="100%" height="36px" variant="block" />
    <SkeletonLoader width="100%" height="20px" :count="5" />
  </div>

  <!-- Search skeleton: results -->
  <div v-else-if="variant === 'search'" class="skeleton-search" aria-busy="true" aria-label="Searching">
    <SkeletonLoader width="40%" height="24px" variant="block" />
    <SkeletonLoader width="100%" height="64px" variant="block" :count="4" />
  </div>

  <!-- Tree skeleton: sidebar folders/pages -->
  <div v-else-if="variant === 'tree'" class="skeleton-tree" aria-busy="true" aria-label="Loading documents">
    <SkeletonLoader width="70%" height="14px" />
    <SkeletonLoader width="60%" height="14px" :style="{ marginLeft: '16px' }" />
    <SkeletonLoader width="55%" height="14px" :style="{ marginLeft: '16px' }" />
    <SkeletonLoader width="75%" height="14px" />
    <SkeletonLoader width="50%" height="14px" :style="{ marginLeft: '16px' }" />
    <SkeletonLoader width="65%" height="14px" />
  </div>

  <!-- Graph skeleton: canvas placeholder -->
  <div v-else-if="variant === 'graph'" class="skeleton-graph" aria-busy="true" aria-label="Loading graph">
    <SkeletonLoader width="100%" height="100%" variant="block" />
  </div>

  <!-- Form skeleton: fields + button -->
  <div v-else-if="variant === 'form'" class="skeleton-form" aria-busy="true" aria-label="Loading form">
    <SkeletonLoader width="30%" height="24px" variant="block" />
    <SkeletonLoader width="100%" height="14px" />
    <SkeletonLoader width="100%" height="36px" variant="block" />
    <SkeletonLoader width="100%" height="14px" />
    <SkeletonLoader width="100%" height="36px" variant="block" />
    <SkeletonLoader width="25%" height="36px" variant="block" />
  </div>
</template>

<style scoped>
.skeleton-page,
.skeleton-editor,
.skeleton-table,
.skeleton-search,
.skeleton-form {
  padding: 48px 0;
}

@media (max-width: 767px) {
  .skeleton-page,
  .skeleton-editor,
  .skeleton-table,
  .skeleton-search,
  .skeleton-form {
    padding: 32px 0;
  }
}

.skeleton-editor {
  display: flex;
  gap: 24px;
}

.skeleton-editor-col {
  flex: 1;
}

.skeleton-tree {
  padding: 16px 0;
}

.skeleton-graph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  opacity: 0.92;
}
</style>
