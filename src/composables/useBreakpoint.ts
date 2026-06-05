import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export const BP_MOBILE_MAX = 767
export const BP_TABLET_MAX = 1023

export function useBreakpoint() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : BP_TABLET_MAX + 1)

  const isMobile = computed(() => width.value <= BP_MOBILE_MAX)
  const isTablet = computed(() => width.value > BP_MOBILE_MAX && width.value <= BP_TABLET_MAX)
  const isDesktop = computed(() => width.value > BP_TABLET_MAX)
  const isNarrow = computed(() => width.value <= BP_TABLET_MAX)

  function update() {
    width.value = window.innerWidth
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
  })

  return { width, isMobile, isTablet, isDesktop, isNarrow }
}
