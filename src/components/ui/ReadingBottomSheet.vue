<script setup lang="ts">
defineProps<{
  open: boolean
  ariaLabel: string
}>()
</script>

<template>
  <aside
    v-if="open"
    class="reading-bottom-sheet"
    data-testid="reading-bottom-sheet"
    role="complementary"
    :aria-label="ariaLabel"
  >
    <slot />
  </aside>
</template>

<style scoped>
/* Keep max-width in sync with BP_READING_SHEET_MAX (1100) in useBreakpoint.ts */
.reading-bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 50vh;
  overflow: auto;
  border-top: 1px solid var(--color-border);
  border-radius: 12px 12px 0 0;
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  background: var(--color-bg);
}

.reading-bottom-sheet :deep(.annotation-panel) {
  width: 100%;
  height: auto;
  max-height: none;
  border-left: none;
  border-radius: 12px 12px 0 0;
}

.reading-bottom-sheet :deep(.reading-toc) {
  position: static;
  max-height: none;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}
</style>
