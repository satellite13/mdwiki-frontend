import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { readString, writeString } from '@/utils/localPreferences'

type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

function readStoredTheme(): Theme {
  const raw = readString(THEME_KEY)
  return raw === 'dark' ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(readStoredTheme())

  const isDark = computed(() => theme.value === 'dark')

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply()
  }

  function apply() {
    document.documentElement.dataset.theme = theme.value === 'dark' ? 'dark' : ''
    writeString(THEME_KEY, theme.value)
  }

  apply()

  return { theme, isDark, toggle, apply }
})
