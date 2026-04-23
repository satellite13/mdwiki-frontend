<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
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

let pointerMoveHandler: ((event: MouseEvent) => void) | null = null
let pointerUpHandler: (() => void) | null = null

function clearResizeListeners() {
  if (pointerMoveHandler) window.removeEventListener('mousemove', pointerMoveHandler)
  if (pointerUpHandler) window.removeEventListener('mouseup', pointerUpHandler)
  pointerMoveHandler = null
  pointerUpHandler = null
}

function startSidebarResize(event: MouseEvent) {
  if (isReadingMode.value) return
  const body = appBodyRef.value
  if (!body) return
  sidebarDragging.value = true
  const rect = body.getBoundingClientRect()
  pointerMoveHandler = (moveEvent: MouseEvent) => {
    const raw = moveEvent.clientX - rect.left
    const nextWidth = clampDocumentsSidebarWidth(raw)
    sidebarWidth.value = nextWidth
    writeDocumentsSidebarWidthPref(nextWidth)
  }
  pointerUpHandler = () => {
    sidebarDragging.value = false
    clearResizeListeners()
  }
  window.addEventListener('mousemove', pointerMoveHandler)
  window.addEventListener('mouseup', pointerUpHandler)
  event.preventDefault()
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
  clearResizeListeners()
})
</script>

<template>
  <div class="app-layout" :class="{ 'reading-mode': isReadingMode }">
    <AppHeader v-if="!isReadingMode" />
    <div ref="appBodyRef" class="app-body" :class="{ resizing: sidebarDragging }">
      <AppSidebar v-if="!isReadingMode" :width="sidebarWidth" />
      <div
        v-if="!isReadingMode"
        class="sidebar-resizer"
        :class="{ dragging: sidebarDragging }"
        role="separator"
        aria-orientation="vertical"
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

.sidebar-resizer {
  width: 8px;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.sidebar-resizer::before {
  content: '';
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 85%, transparent);
  transition: background 0.12s ease, transform 0.12s ease;
}

.sidebar-resizer:hover::before,
.sidebar-resizer.dragging::before {
  background: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  transform: scaleX(1.15);
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
