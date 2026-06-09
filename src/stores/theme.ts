import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import { readString, writeString } from '@/utils/localPreferences'

type Theme = 'light' | 'dark'
type ThemeMode = Theme | 'system'

const THEME_KEY = 'theme'

function readStoredMode(): ThemeMode {
  const raw = readString(THEME_KEY)
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw
  return 'system'
}

function resolveSystemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredMode())
  const systemDark = ref<boolean>(resolveSystemIsDark())
  let mediaQuery: MediaQueryList | null = null

  const resolved = computed<Theme>(() => {
    if (mode.value === 'system') return systemDark.value ? 'dark' : 'light'
    return mode.value
  })

  const isDark = computed(() => resolved.value === 'dark')

  function listenSystem() {
    if (!mediaQuery) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        systemDark.value = e.matches
        if (mode.value === 'system') apply()
      }
      mediaQuery.addEventListener('change', handler)
    }
  }

  function unlistenSystem() {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', () => {})
      mediaQuery = null
    }
  }

  function apply() {
    document.documentElement.dataset.theme = resolved.value === 'dark' ? 'dark' : ''
    writeString(THEME_KEY, mode.value)
  }

  function setTheme(m: ThemeMode) {
    mode.value = m
    apply()
    if (m === 'system') listenSystem()
  }

  function toggle() {
    mode.value = mode.value === 'light' ? 'dark' : mode.value === 'dark' ? 'system' : 'light'
    apply()
    if (mode.value === 'system') listenSystem()
  }

  // Init
  if (mode.value === 'system') listenSystem()
  apply()

  onUnmounted(() => unlistenSystem())

  return { mode, resolved, isDark, toggle, apply, setTheme }
})
