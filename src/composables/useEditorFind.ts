import { computed, ref, type Ref } from 'vue'
import {
  findMatchIndices,
  nextMatchIndex,
  prevMatchIndex,
  scrollTextareaSelectionIntoView
} from '@/utils/editorFind'

export interface EditorFindOptions {
  getEditor: () => HTMLTextAreaElement | null
  getSource: () => string
}

export interface EditorFindApi {
  open: Ref<boolean>
  query: Ref<string>
  matchIndices: Ref<number[]>
  activeIndex: Ref<number>
  matchCount: Ref<number>
  currentMatch: Ref<number>
  statusLabel: Ref<string>
  openFind: (initialQuery?: string) => void
  closeFind: () => void
  refreshMatches: () => void
  findNext: () => void
  findPrev: () => void
  handleKeydown: (event: KeyboardEvent) => boolean
}

export function useEditorFind(options: EditorFindOptions): EditorFindApi {
  const open = ref(false)
  const query = ref('')
  const matchIndices = ref<number[]>([])
  const activeIndex = ref(-1)

  const matchCount = computed(() => matchIndices.value.length)
  const currentMatch = computed(() => (activeIndex.value >= 0 ? activeIndex.value + 1 : 0))

  const statusLabel = computed(() => {
    if (!query.value.trim()) return ''
    if (matchCount.value === 0) return 'no-results'
    return `${currentMatch.value}/${matchCount.value}`
  })

  function selectMatch(index: number): void {
    const el = options.getEditor()
    const needle = query.value.trim()
    if (!el || !needle || index < 0 || index >= matchIndices.value.length) return
    const start = matchIndices.value[index]
    const end = start + needle.length
    activeIndex.value = index
    // Do not el.focus() — that steals the caret from the find input on every keystroke.
    el.setSelectionRange(start, end)
    scrollTextareaSelectionIntoView(el)
  }

  function refreshMatches(): void {
    const needle = query.value.trim()
    if (!needle) {
      matchIndices.value = []
      activeIndex.value = -1
      return
    }
    matchIndices.value = findMatchIndices(options.getSource(), needle)
    if (matchIndices.value.length === 0) {
      activeIndex.value = -1
      return
    }
    const el = options.getEditor()
    const cursor = el?.selectionStart ?? 0
    activeIndex.value = nextMatchIndex(matchIndices.value, cursor, -1)
    selectMatch(activeIndex.value)
  }

  function findNext(): void {
    if (!query.value.trim()) return
    if (matchIndices.value.length === 0) {
      refreshMatches()
      return
    }
    const el = options.getEditor()
    const cursor = el?.selectionStart ?? 0
    activeIndex.value = nextMatchIndex(matchIndices.value, cursor, activeIndex.value)
    selectMatch(activeIndex.value)
  }

  function findPrev(): void {
    if (!query.value.trim() || matchIndices.value.length === 0) return
    const el = options.getEditor()
    const cursor = el?.selectionStart ?? 0
    activeIndex.value = prevMatchIndex(matchIndices.value, cursor, activeIndex.value)
    selectMatch(activeIndex.value)
  }

  function openFind(initialQuery?: string): void {
    open.value = true
    const el = options.getEditor()
    const selected = el && el.selectionStart !== el.selectionEnd
      ? options.getSource().slice(el.selectionStart, el.selectionEnd)
      : ''
    query.value = (initialQuery ?? selected).trim()
    refreshMatches()
  }

  function closeFind(): void {
    open.value = false
    query.value = ''
    matchIndices.value = []
    activeIndex.value = -1
    options.getEditor()?.focus()
  }

  function handleKeydown(event: KeyboardEvent): boolean {
    if (!open.value) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      closeFind()
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) findPrev()
      else findNext()
      return true
    }
    return false
  }

  return {
    open,
    query,
    matchIndices,
    activeIndex,
    matchCount,
    currentMatch,
    statusLabel,
    openFind,
    closeFind,
    refreshMatches,
    findNext,
    findPrev,
    handleKeydown
  }
}
