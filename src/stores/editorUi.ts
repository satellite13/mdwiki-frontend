import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEditorUiStore = defineStore('editor-ui', () => {
  const isReadingMode = ref(false)
  const mobileSidebarOpen = ref(false)
  const mobileNavOpen = ref(false)

  function setReadingMode(value: boolean) {
    isReadingMode.value = value
  }

  function toggleMobileSidebar() {
    mobileSidebarOpen.value = !mobileSidebarOpen.value
    if (mobileSidebarOpen.value) mobileNavOpen.value = false
  }

  function openMobileSidebar() {
    mobileSidebarOpen.value = true
    mobileNavOpen.value = false
  }

  function closeMobileSidebar() {
    mobileSidebarOpen.value = false
  }

  function toggleMobileNav() {
    mobileNavOpen.value = !mobileNavOpen.value
    if (mobileNavOpen.value) mobileSidebarOpen.value = false
  }

  function closeMobileNav() {
    mobileNavOpen.value = false
  }

  function closeMobileOverlays() {
    mobileSidebarOpen.value = false
    mobileNavOpen.value = false
  }

  return {
    isReadingMode,
    mobileSidebarOpen,
    mobileNavOpen,
    setReadingMode,
    toggleMobileSidebar,
    openMobileSidebar,
    closeMobileSidebar,
    toggleMobileNav,
    closeMobileNav,
    closeMobileOverlays
  }
})
