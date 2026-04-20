<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import { useEditorUiStore } from '@/stores/editorUi'

const editorUi = useEditorUiStore()
const { isReadingMode } = storeToRefs(editorUi)

function onKeydown(e: KeyboardEvent) {
  // Ctrl+K or Cmd+K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-form input') as HTMLInputElement
    searchInput?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-layout" :class="{ 'reading-mode': isReadingMode }">
    <AppHeader v-if="!isReadingMode" />
    <div class="app-body">
      <AppSidebar v-if="!isReadingMode" />
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-body {
  display: flex;
  flex: 1;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  overflow-y: auto;
  height: calc(100vh - 49px);
  background: var(--color-bg);
}

.app-layout.reading-mode .app-main {
  padding: 0;
  height: 100vh;
}
</style>
