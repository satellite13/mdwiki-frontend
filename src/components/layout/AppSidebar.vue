<script setup lang="ts">
import { computed } from 'vue'
import DocumentTree from '@/components/tree/DocumentTree.vue'

const props = defineProps<{
  width: number
  variant?: 'inline' | 'drawer'
  open?: boolean
}>()

const isDrawer = computed(() => props.variant === 'drawer')

const sidebarStyle = computed(() => {
  if (isDrawer.value) return undefined
  return { width: `${props.width}px` }
})
</script>

<template>
  <aside
    class="sidebar"
    :class="{
      'sidebar--drawer': isDrawer,
      'sidebar--open': isDrawer && open
    }"
    :style="sidebarStyle"
    :aria-hidden="isDrawer ? !open : undefined"
  >
    <DocumentTree />
  </aside>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  height: calc(100vh - var(--app-header-height));
  overflow: hidden;
}

.sidebar--drawer {
  position: fixed;
  top: var(--app-header-height);
  left: 0;
  bottom: 0;
  z-index: 100;
  width: var(--sidebar-width-mobile);
  border-right: 1px solid var(--color-border);
  box-shadow: 4px 0 24px rgba(15, 17, 21, 0.18);
  transform: translateX(-105%);
  transition: transform 0.22s ease;
}

.sidebar--drawer.sidebar--open {
  transform: translateX(0);
}

@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar:not(.sidebar--drawer) {
    width: var(--sidebar-width-tablet) !important;
  }
}
</style>
