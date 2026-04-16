import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  )

  const isDark = computed(() => theme.value === 'dark')

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply()
  }

  function apply() {
    document.documentElement.dataset.theme = theme.value === 'dark' ? 'dark' : ''
    localStorage.setItem('theme', theme.value)
  }

  // Apply on creation
  apply()

  return { theme, isDark, toggle, apply }
})
