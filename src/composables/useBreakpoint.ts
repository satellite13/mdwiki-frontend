import { computed, ref } from 'vue'

export const BP_MOBILE_MAX = 767
export const BP_TABLET_MAX = 1023

// Синглтон: один resize-listener на всё приложение вместо слушателя на каждый компонент.
const width = ref(typeof window !== 'undefined' ? window.innerWidth : BP_TABLET_MAX + 1)

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    width.value = window.innerWidth
  }, { passive: true })
}

export function useBreakpoint() {
  const isMobile = computed(() => width.value <= BP_MOBILE_MAX)
  const isTablet = computed(() => width.value > BP_MOBILE_MAX && width.value <= BP_TABLET_MAX)
  const isDesktop = computed(() => width.value > BP_TABLET_MAX)
  const isNarrow = computed(() => width.value <= BP_TABLET_MAX)

  return { width, isMobile, isTablet, isDesktop, isNarrow }
}
