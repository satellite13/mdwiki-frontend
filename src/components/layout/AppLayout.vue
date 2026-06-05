<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import VerticalPaneResizer from '@/components/ui/VerticalPaneResizer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useHorizontalDragResize } from '@/composables/useHorizontalDragResize'
import { useEditorUiStore } from '@/stores/editorUi'
import {
  clampDocumentsSidebarWidth,
  DEFAULT_DOCUMENTS_SIDEBAR_WIDTH,
  readDocumentsSidebarWidthPref,
  writeDocumentsSidebarWidthPref
} from './sidebarPreferences'

const route = useRoute()
const editorUi = useEditorUiStore()
const { isReadingMode, mobileSidebarOpen } = storeToRefs(editorUi)
const { isMobile, isTablet, isDesktop } = useBreakpoint()
const appBodyRef = ref<HTMLElement | null>(null)
const sidebarWidth = ref(readDocumentsSidebarWidthPref())
const sidebarDragging = ref(false)
const { startResizeDrag, clearDragListeners } = useHorizontalDragResize()

const effectiveSidebarWidth = computed(() => {
  if (isMobile.value) return 0
  if (isTablet.value) return 220
  return sidebarWidth.value
})

const showSidebarResizer = computed(() => isDesktop.value && !isReadingMode.value)
const showInlineSidebar = computed(() => !isMobile.value && !isReadingMode.value)
const showMobileSidebar = computed(() => isMobile.value && !isReadingMode.value)

function startSidebarResize(event: MouseEvent) {
  if (isReadingMode.value || !isDesktop.value) return
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
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-form input') as HTMLInputElement
    searchInput?.focus()
  }
}

watch(() => route.fullPath, () => {
  editorUi.closeMobileOverlays()
})

watch(isMobile, (mobile) => {
  if (!mobile) editorUi.closeMobileSidebar()
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  clearDragListeners()
})
</script>

<template>
  <div
    class="app-layout"
    :class="{
      'reading-mode': isReadingMode,
      'mobile-sidebar-open': mobileSidebarOpen
    }"
  >
    <AppHeader v-if="!isReadingMode" />
    <div ref="appBodyRef" class="app-body" :class="{ resizing: sidebarDragging }">
      <AppSidebar
        v-if="showInlineSidebar"
        :width="effectiveSidebarWidth"
        variant="inline"
      />
      <AppSidebar
        v-if="showMobileSidebar"
        :width="0"
        variant="drawer"
        :open="mobileSidebarOpen"
      />
      <button
        v-if="showMobileSidebar && mobileSidebarOpen"
        type="button"
        class="sidebar-backdrop"
        aria-label="Close sidebar"
        @click="editorUi.closeMobileSidebar()"
      />
      <VerticalPaneResizer
        v-if="showSidebarResizer"
        :dragging="sidebarDragging"
        ariaLabel="Resize documents sidebar"
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
  position: relative;
}

.app-body.resizing {
  cursor: col-resize;
  user-select: none;
}

.app-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  overflow-y: auto;
  height: calc(100vh - var(--app-header-height));
  background: var(--color-bg);
}

.app-layout.reading-mode .app-main {
  padding: 0;
  height: 100vh;
}

.sidebar-backdrop {
  position: fixed;
  inset: var(--app-header-height) 0 0 0;
  z-index: 90;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(15, 17, 21, 0.45);
  cursor: pointer;
}

@media (max-width: 1023px) {
  .app-main {
    padding: 16px 20px;
  }
}

@media (max-width: 767px) {
  .app-main {
    padding: 12px 14px;
  }

  .app-layout.mobile-sidebar-open .app-main {
    overflow: hidden;
  }
}
</style>
