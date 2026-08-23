import { nextTick, ref } from 'vue'
import { listAnnotations } from '@/api/annotations'
import type { Annotation } from '@/types'
import { getPageSlugFromUrl } from '@/utils/pageSlug'
import { groupAnnotationsByText } from '@/utils/groupAnnotations'
import type { EditorMode } from './editorPreferences'

export interface AnnotationsOptions {
  getPreviewContentElement: () => HTMLElement | null
  getEditorMode: () => EditorMode
}

/** Аннотации в режиме чтения: загрузка, подсветка в preview, floating-кнопка, popup и tooltip. */
export function useAnnotations(options: AnnotationsOptions) {
  const annotations = ref<Annotation[]>([])
  const annotationsVisible = ref(false)
  const annotationPopup = ref<{ selectedText: string; anchorContext: string; x: number; y: number } | null>(null)
  const floatingBtn = ref<{ x: number; y: number } | null>(null)
  const pendingAnnotation = ref<{ text: string; context: string } | null>(null)
  const tooltipAnnotation = ref<{ annotations: Annotation[]; index: number; x: number; y: number } | null>(null)
  let annotationHighlightSpans: HTMLSpanElement[] = []
  let touchEndTimer: ReturnType<typeof setTimeout> | undefined

  async function fetchAnnotations() {
    const slug = getPageSlugFromUrl()
    if (!slug) return
    try {
      const { data } = await listAnnotations(slug)
      annotations.value = data
    } catch (e) {
      console.warn('Failed to load annotations:', e)
      annotations.value = []
    }
  }

  function clearAnnotationHighlights() {
    for (const span of annotationHighlightSpans) {
      const parent = span.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent || ''), span)
        parent.normalize()
      }
    }
    annotationHighlightSpans = []
  }

  function applyAnnotationHighlights() {
    clearAnnotationHighlights()
    if (annotations.value.length === 0) return
    const container = options.getPreviewContentElement()
    if (!container) return

    for (const group of groupAnnotationsByText(annotations.value)) {
      const groupAnnotations = group.ids
        .map((id) => annotations.value.find((a) => a.id === id))
        .filter((a): a is Annotation => a !== undefined)
      if (groupAnnotations.length === 0) continue
      const color = groupAnnotations[0].color || '#ffeb3b'
      highlightTextInNode(container, group.text, color, groupAnnotations)
    }
  }

  function highlightTextInNode(root: HTMLElement, searchText: string, color: string, groupAnnotations: Annotation[]) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.textContent || !node.textContent.includes(searchText)) return NodeFilter.FILTER_REJECT
        const parent = node.parentElement
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'MARK') {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })

    const nodes: Text[] = []
    while (walker.nextNode()) {
      nodes.push(walker.currentNode as Text)
    }

    for (const textNode of nodes) {
      const content = textNode.textContent || ''
      const idx = content.indexOf(searchText)
      if (idx === -1) continue

      const before = content.slice(0, idx)
      const match = content.slice(idx, idx + searchText.length)
      const after = content.slice(idx + searchText.length)

      const parent = textNode.parentNode!
      const beforeNode = document.createTextNode(before)
      const markEl = document.createElement('mark')
      markEl.className = 'annotation-highlight'
      markEl.style.backgroundColor = color
      markEl.style.borderRadius = '2px'
      markEl.style.padding = '0 1px'
      markEl.dataset.annotationText = searchText
      markEl.dataset.annotationIds = JSON.stringify(groupAnnotations.map((a) => a.id))
      markEl.textContent = match
      const afterNode = document.createTextNode(after)

      annotationHighlightSpans.push(markEl)
      markEl.addEventListener('click', (e) => {
        e.stopPropagation()
        const rect = (e.target as HTMLElement).getBoundingClientRect()
        tooltipAnnotation.value = {
          annotations: groupAnnotations,
          index: 0,
          x: rect.left + rect.width / 2,
          y: rect.top - 8
        }
      })
      parent.insertBefore(beforeNode, textNode)
      parent.insertBefore(markEl, textNode)
      parent.insertBefore(afterNode, textNode)
      parent.removeChild(textNode)
      break
    }
  }

  /** Контекст вокруг выделенного текста (±40 символов) для anchor_context аннотации. */
  function buildSelectionContext(selectedText: string): { text: string; context: string } {
    const container = options.getPreviewContentElement()
    const fullText = container?.textContent || ''
    const idx = fullText.indexOf(selectedText)
    const ctxStart = Math.max(0, idx - 40)
    const ctxEnd = Math.min(fullText.length, idx + selectedText.length + 40)
    return { text: selectedText, context: fullText.slice(ctxStart, ctxEnd) }
  }

  function showFloatingButtonForSelection(clearPendingOnEmpty: boolean) {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      floatingBtn.value = null
      if (clearPendingOnEmpty) pendingAnnotation.value = null
      return
    }
    const selectedText = sel.toString().trim()
    pendingAnnotation.value = buildSelectionContext(selectedText)
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    floatingBtn.value = {
      x: rect.left + rect.width / 2 - 60,
      y: rect.top - 36
    }
  }

  function onReadingMouseUp() {
    if (options.getEditorMode() !== 'reading') return
    showFloatingButtonForSelection(true)
  }

  function onReadingMouseDown() {
    floatingBtn.value = null
    pendingAnnotation.value = null
  }

  function onReadingTouchEnd() {
    touchEndTimer = setTimeout(() => {
      if (options.getEditorMode() !== 'reading') return
      showFloatingButtonForSelection(false)
    }, 10)
  }

  function startAnnotation() {
    const sel = window.getSelection()
    let selectedText: string
    let anchorContext: string

    if (pendingAnnotation.value) {
      selectedText = pendingAnnotation.value.text
      anchorContext = pendingAnnotation.value.context
      pendingAnnotation.value = null
    } else {
      if (!sel || sel.isCollapsed) return
      selectedText = sel.toString().trim()
      if (!selectedText) return
      anchorContext = buildSelectionContext(selectedText).context
    }

    const btn = floatingBtn.value
    annotationPopup.value = {
      selectedText,
      anchorContext,
      x: (btn?.x ?? 200) - 140,
      y: (btn?.y ?? 100) + 40
    }
    floatingBtn.value = null
    window.getSelection()?.removeAllRanges()
  }

  function onAnnotationCreated(annotation: Annotation) {
    annotations.value = [...annotations.value, annotation]
    void nextTick().then(() => applyAnnotationHighlights())
  }

  function onAnnotationDeleted(id: string) {
    annotations.value = annotations.value.filter((a) => a.id !== id)
    void nextTick().then(() => applyAnnotationHighlights())
  }

  /** Реакция на смену режима редактора: в reading — подгрузить и подсветить, иначе — сбросить. */
  function handleModeChange(mode: EditorMode) {
    if (mode === 'reading') {
      annotationsVisible.value = false
      void fetchAnnotations().then(() => {
        void nextTick().then(() => applyAnnotationHighlights())
      })
    } else {
      clearAnnotationHighlights()
      annotationsVisible.value = false
    }
  }

  function dispose() {
    if (touchEndTimer !== undefined) clearTimeout(touchEndTimer)
  }

  return {
    annotations,
    annotationsVisible,
    annotationPopup,
    floatingBtn,
    tooltipAnnotation,
    fetchAnnotations,
    applyAnnotationHighlights,
    clearAnnotationHighlights,
    onReadingMouseUp,
    onReadingMouseDown,
    onReadingTouchEnd,
    startAnnotation,
    onAnnotationCreated,
    onAnnotationDeleted,
    handleModeChange,
    dispose
  }
}

/** Скроллит к подсветке аннотации по id и ненадолго мигает ей, чтобы показать место. */
export function scrollToAnnotation(annotationId: string): void {
  const marks = document.querySelectorAll<HTMLElement>('mark.annotation-highlight')
  for (const markEl of Array.from(marks)) {
    if (!parseAnnotationIds(markEl).includes(annotationId)) continue
    markEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    markEl.classList.add('annotation-flash')
    window.setTimeout(() => markEl.classList.remove('annotation-flash'), 1200)
    break
  }
}

function parseAnnotationIds(markEl: HTMLElement): string[] {
  try {
    const parsed: unknown = JSON.parse(markEl.dataset.annotationIds || '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
