import { computed, ref, type Ref } from 'vue'
import {
  applyPreviewFindHighlights,
  clearPreviewFindHighlights,
  findPreviewMatchRanges,
  scrollPreviewFindActiveIntoView
} from '@/utils/previewFind'

export interface PreviewFindOptions {
  getRoot: () => HTMLElement | null
}

export interface PreviewFindApi {
  open: Ref<boolean>
  query: Ref<string>
  matchCount: Ref<number>
  currentMatch: Ref<number>
  statusLabel: Ref<string>
  openFind: (initialQuery?: string) => void
  closeFind: () => void
  refreshMatches: () => void
  findNext: () => void
  findPrev: () => void
}

export function usePreviewFind(options: PreviewFindOptions): PreviewFindApi {
  const open = ref(false)
  const query = ref('')
  const matchCount = ref(0)
  const activeIndex = ref(-1)

  const currentMatch = computed(() => (activeIndex.value >= 0 ? activeIndex.value + 1 : 0))

  const statusLabel = computed(() => {
    if (!query.value.trim()) return ''
    if (matchCount.value === 0) return 'no-results'
    return `${currentMatch.value}/${matchCount.value}`
  })

  function selectedPreviewText(): string {
    const root = options.getRoot()
    const sel = window.getSelection()
    if (!root || !sel || sel.isCollapsed) return ''
    const text = sel.toString().trim()
    if (!text) return ''
    const anchor = sel.anchorNode
    if (anchor && root.contains(anchor)) return text
    return ''
  }

  function paint(index: number): void {
    const root = options.getRoot()
    if (!root) {
      matchCount.value = 0
      activeIndex.value = -1
      return
    }
    const needle = query.value.trim()
    if (!needle) {
      clearPreviewFindHighlights(root)
      matchCount.value = 0
      activeIndex.value = -1
      return
    }
    const count = applyPreviewFindHighlights(root, needle, index)
    matchCount.value = count
    activeIndex.value = count === 0 ? -1 : index
    if (count > 0) scrollPreviewFindActiveIntoView(root)
  }

  function refreshMatches(): void {
    const root = options.getRoot()
    const needle = query.value.trim()
    if (!root || !needle) {
      if (root) clearPreviewFindHighlights(root)
      matchCount.value = 0
      activeIndex.value = -1
      return
    }
    const count = findPreviewMatchRanges(root, needle).length
    if (count === 0) {
      clearPreviewFindHighlights(root)
      matchCount.value = 0
      activeIndex.value = -1
      return
    }
    const next = activeIndex.value >= 0 && activeIndex.value < count ? activeIndex.value : 0
    paint(next)
  }

  function findNext(): void {
    if (!query.value.trim()) return
    if (matchCount.value === 0) {
      refreshMatches()
      return
    }
    paint((activeIndex.value + 1) % matchCount.value)
  }

  function findPrev(): void {
    if (!query.value.trim() || matchCount.value === 0) return
    paint((activeIndex.value - 1 + matchCount.value) % matchCount.value)
  }

  function openFind(initialQuery?: string): void {
    open.value = true
    query.value = (initialQuery ?? selectedPreviewText()).trim()
    activeIndex.value = -1
    refreshMatches()
  }

  function closeFind(): void {
    const root = options.getRoot()
    if (root) clearPreviewFindHighlights(root)
    open.value = false
    query.value = ''
    matchCount.value = 0
    activeIndex.value = -1
  }

  return {
    open,
    query,
    matchCount,
    currentMatch,
    statusLabel,
    openFind,
    closeFind,
    refreshMatches,
    findNext,
    findPrev
  }
}
