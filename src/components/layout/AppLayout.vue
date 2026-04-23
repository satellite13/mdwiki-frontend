<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import VerticalPaneResizer from '@/components/ui/VerticalPaneResizer.vue'
import { useHorizontalDragResize } from '@/composables/useHorizontalDragResize'
import { useEditorUiStore } from '@/stores/editorUi'
import {
  clampDocumentsSidebarWidth,
  DEFAULT_DOCUMENTS_SIDEBAR_WIDTH,
  readDocumentsSidebarWidthPref,
  writeDocumentsSidebarWidthPref
} from './sidebarPreferences'

const editorUi = useEditorUiStore()
const { isReadingMode } = storeToRefs(editorUi)
const appBodyRef = ref<HTMLElement | null>(null)
const sidebarWidth = ref(readDocumentsSidebarWidthPref())
const sidebarDragging = ref(false)
const { startResizeDrag, clearDragListeners } = useHorizontalDragResize()

function startSidebarResize(event: MouseEvent) {
  if (isReadingMode.value) return
  const body = appBodyRef.value
  if (!body) return
  const rect = body.getBoundingClientRect()
  startResizeDrag(event, {
    onStart: () => {
      sidebarDragging.value = true
    },
    onMove: (moveEvent) => {
      const raw = moveEvent.clientX - rect.left
      const nextWidth = clampDocumentsSidebarWidth(raw)
      sidebarWidth.value = nextWidth
      writeDocumentsSidebarWidthPref(nextWidth)
    },
    onEnd: () => {
      sidebarDragging.value = false
    }
  })
}

function resetSidebarWidth() {
  sidebarWidth.value = DEFAULT_DOCUMENTS_SIDEBAR_WIDTH
  writeDocumentsSidebarWidthPref(DEFAULT_DOCUMENTS_SIDEBAR_WIDTH)
}

function onKeydown(e: KeyboardEvent) {
  // Ctrl+K or Cmd+K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-form input') as HTMLInputElement
    searchInput?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  clearDragListeners()
})
</script>

<template>
  <div class="app-layout" :class="{ 'reading-mode': isReadingMode }">
    <AppHeader v-if="!isReadingMode" />
    <div ref="appBodyRef" class="app-body" :class="{ resizing: sidebarDragging }">
      <AppSidebar v-if="!isReadingMode" :width="sidebarWidth" />
      <VerticalPaneResizer
        v-if="!isReadingMode"
        :dragging="sidebarDragging"
        aria-label="Resize documents sidebar"
        @mousedown="startSidebarResize"
        @dblclick="resetSidebarWidth"
      />
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

.app-body.resizing {
  cursor: col-resize;
  user-select: none;
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
