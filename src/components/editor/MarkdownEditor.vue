<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDialogStore } from '@/stores/dialog'
import { useThemeStore } from '@/stores/theme'
import { uploadAttachment } from '@/api/attachments'
import { listAnnotations } from '@/api/annotations'
import { getApiErrorMessage } from '@/utils/apiError'
import { downloadPagePdf } from '@/utils/exportPagePdf'
import { t } from '@/utils/i18n'
import { readString, writeString } from '@/utils/localPreferences'
import { useEditorHistory } from '@/composables/useEditorHistory'
import { useWikilinkAutocomplete } from '@/composables/useWikilinkAutocomplete'
import { useEditorFind } from '@/composables/useEditorFind'
import { getPages } from '@/services/pageIndex'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useHorizontalDragResize } from '@/composables/useHorizontalDragResize'
import { normalizePageSlug } from '@/utils/pageSlug'
import { formatPipeTableAtCursor } from '@/utils/formatMarkdownTable'
import VerticalPaneResizer from '@/components/ui/VerticalPaneResizer.vue'
import ReadingToolbar from '@/components/editor/ReadingToolbar.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import EditorPreviewPane from '@/components/editor/EditorPreviewPane.vue'
import EditorInputPane from '@/components/editor/EditorInputPane.vue'
import AnnotationPanel from '@/components/annotations/AnnotationPanel.vue'
import AnnotationPopup from '@/components/annotations/AnnotationPopup.vue'
import type { Annotation } from '@/types'
import { usePreviewCopyDecorations } from '@/components/editor/usePreviewCopyDecorations'
import { usePreviewRenderPipeline } from '@/components/editor/usePreviewRenderPipeline'
import { useReadingToc } from '@/components/editor/useReadingToc'
import { useSplitScrollSync } from '@/components/editor/useSplitScrollSync'
import type { ToolbarAction } from './toolbarTypes'
import type MarkdownIt from 'markdown-it'
import { renderStructurizrSvg } from './structurizr'
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  readEditorModePref,
  readSplitRatioPref,
  writeEditorModePref,
  writeSplitRatioPref,
  type EditorMode
} from './editorPreferences'

const READING_FONT_SIZE_KEY = 'mdwiki-reading-font-size'
const READING_THEME_KEY = 'mdwiki-reading-theme'
const READING_FONT_MIN = 14
const READING_FONT_MAX = 28

type ReadingTheme = 'white' | 'paper' | 'dark'

const EMOJI_ITEMS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '🙂', '😉', '😍', '😘', '😗', '😚', '😋', '😎',
  '🤩', '🤔', '🫠', '😐', '😑', '🙄', '😴', '🤯',
  '🥳', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥',
  '✨', '💡', '🎯', '✅', '❌', '⚠️', '🚀', '📌',
  '📎', '📷', '🧠', '🔧', '📝', '💬', '🌟', '💯'
]

let markdownRenderer: MarkdownIt | null = null
let markdownRendererPromise: Promise<MarkdownIt> | null = null
let previewRenderToken = 0

async function getMarkdownRenderer(): Promise<MarkdownIt> {
  if (markdownRenderer) return markdownRenderer
  if (!markdownRendererPromise) {
    markdownRendererPromise = import('./markdown').then(({ createMarkdownRenderer }) => {
      markdownRenderer = createMarkdownRenderer()
      return markdownRenderer
    })
  }
  return markdownRendererPromise
}

const props = defineProps<{
  modelValue: string
  readingTitle?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
  'mode-change': [mode: EditorMode]
}>()

const themeStore = useThemeStore()
const dialog = useDialogStore()
const { isMobile } = useBreakpoint()

const uploadError = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)
const editorRef = ref<InstanceType<typeof EditorInputPane> | null>(null)
const splitShellRef = ref<HTMLElement | null>(null)
const previewPaneRef = ref<InstanceType<typeof EditorPreviewPane> | null>(null)

const editorMode = ref<EditorMode>(readEditorModePref())
const splitRatio = ref(readSplitRatioPref())
const splitDragging = ref(false)
const markdownValue = ref(props.modelValue)

const history = useEditorHistory(props.modelValue)

const lastNonReadingMode = ref<EditorMode>('split')
const readingFontSize = ref(readReadingFontSizePref())
const readingTheme = ref<ReadingTheme>(readReadingThemePref())
const readingTocVisible = ref(true)
const exportingPdf = ref(false)

const annotations = ref<Annotation[]>([])
const annotationsVisible = ref(false)
const annotationPopup = ref<{ selectedText: string; anchorContext: string; x: number; y: number } | null>(null)
const floatingBtn = ref<{ x: number; y: number } | null>(null)
const pendingAnnotation = ref<{ text: string; context: string } | null>(null)
let annotationHighlightSpans: HTMLSpanElement[] = []

const wikilink = useWikilinkAutocomplete({
  getEditor: () => getEditorElement(),
  getSource: () => markdownValue.value,
  getContainerRect: () => splitShellRef.value?.getBoundingClientRect() ?? null
})
const editorFind = useEditorFind({
  getEditor: () => getEditorElement(),
  getSource: () => markdownValue.value
})
const wikilinkOpen = wikilink.open
const wikilinkItems = wikilink.items
const wikilinkSelected = wikilink.selected
const wikilinkMenuStyle = wikilink.menuStyle
const findBarOpen = computed(() => editorFind.open.value)
const findBarQuery = computed(() => editorFind.query.value)
const findBarStatusLabel = computed(() => editorFind.statusLabel.value)
let wikilinkBlurTimer: ReturnType<typeof setTimeout> | undefined

const { startResizeDrag, clearDragListeners } = useHorizontalDragResize()

const previewHtml = ref('')
const canUndo = history.canUndo
const canRedo = history.canRedo
const emojiItems = computed(() => EMOJI_ITEMS)
const editorShellStyle = computed(() => {
  if (editorMode.value !== 'split') return undefined
  if (isMobile.value) {
    return { gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)' }
  }
  return { gridTemplateColumns: `${splitRatio.value}% 8px minmax(0, 1fr)` }
})
const readingPreviewStyle = computed(() =>
  editorMode.value === 'reading'
    ? { fontSize: `${readingFontSize.value}px` }
    : undefined
)
const previewHasToc = computed(() => editorMode.value === 'reading' && readingTocVisible.value && readingTocItems.value.length > 0)
const previewCopyDecorations = usePreviewCopyDecorations(() => getPreviewPaneElement())
const previewRenderPipeline = usePreviewRenderPipeline({
  getRoot: () => getPreviewPaneElement(),
  shouldRender: () => editorMode.value !== 'editor',
  isDark: () => themeStore.isDark,
  renderStructurizrSvg
})
const readingToc = useReadingToc(() => getPreviewPaneElement())
const readingTocItems = readingToc.readingTocItems
const splitScrollSync = useSplitScrollSync({
  getEditor: () => getEditorElement(),
  getPreview: () => getPreviewPaneElement()
})

const inlineFormatActions: ToolbarAction[] = [
  { key: 'bold', title: 'Bold', ariaLabel: 'Bold', icon: 'format_bold', onClick: () => wrapSelection('**', '**') },
  { key: 'italic', title: 'Italic', ariaLabel: 'Italic', icon: 'format_italic', onClick: () => wrapSelection('*', '*') },
  { key: 'underline', title: 'Underline', ariaLabel: 'Underline', icon: 'format_underlined', onClick: () => wrapSelection('<u>', '</u>') },
  { key: 'strikethrough', title: 'Strikethrough', ariaLabel: 'Strikethrough', icon: 'strikethrough_s', onClick: () => wrapSelection('~~', '~~') },
  { key: 'highlight', title: 'Highlight', ariaLabel: 'Highlight', icon: 'ink_highlighter', onClick: () => wrapSelection('==', '==') },
  { key: 'superscript', title: 'Superscript', ariaLabel: 'Superscript', icon: 'superscript', onClick: () => wrapSelection('^', '^') },
  { key: 'subscript', title: 'Subscript', ariaLabel: 'Subscript', icon: 'subscript', onClick: () => wrapSelection('~', '~') },
  { key: 'inline-code', title: 'Inline code', ariaLabel: 'Inline code', icon: 'code', onClick: () => wrapSelection('`', '`') }
]

const listAndBlockActions: ToolbarAction[] = [
  { key: 'bulleted', title: 'Bulleted list', ariaLabel: 'Bulleted list', icon: 'format_list_bulleted', onClick: () => insertLinePrefix('- ', 'list item') },
  { key: 'numbered', title: 'Numbered list', ariaLabel: 'Numbered list', icon: 'format_list_numbered', onClick: () => insertLinePrefix('1. ', 'list item') },
  { key: 'task', title: 'Task list', ariaLabel: 'Task list', icon: 'checklist', onClick: () => insertLinePrefix('- [ ] ', 'task') },
  { key: 'quote', title: 'Quote', ariaLabel: 'Quote', icon: 'format_quote', onClick: () => insertLinePrefix('> ', 'quote') },
  { key: 'code-block', title: 'Code block', ariaLabel: 'Code block', icon: 'data_object', onClick: () => insertText('\n```\ncode\n```\n') }
]

const quickInsertActions: ToolbarAction[] = [
  { key: 'link', title: 'Link', ariaLabel: 'Link', icon: 'link', onClick: () => wrapSelection('[', '](https://example.com)', 'link text') },
  { key: 'upload-image', title: 'Insert image', ariaLabel: 'Insert image', icon: 'image', onClick: triggerUpload },
  {
    key: 'format-table',
    title: 'Выровнять markdown-таблицу под курсором',
    ariaLabel: 'Выровнять markdown-таблицу под курсором',
    icon: 'format_align_justify',
    onClick: formatMarkdownTableAtCursor
  },
  { key: 'wiki-link', title: 'Wiki link', ariaLabel: 'Wiki link', icon: 'article_shortcut', onClick: () => wrapSelection('[[', ']]', 'Page Title') },
  { key: 'tag', title: 'Tag', ariaLabel: 'Tag', icon: 'sell', onClick: () => insertText(' #tag') },
  { key: 'insert-date', title: 'Insert current date', ariaLabel: 'Insert current date', icon: 'calendar_today', onClick: insertCurrentDate }
]

const historyActions = computed<ToolbarAction[]>(() => [
  { key: 'find', title: t.editor.findTitle, ariaLabel: t.editor.findTitle, icon: 'search', onClick: () => openEditorFind() },
  { key: 'undo', title: 'Undo', ariaLabel: 'Undo', icon: 'undo', onClick: undo, disabled: !canUndo.value },
  { key: 'redo', title: 'Redo', ariaLabel: 'Redo', icon: 'redo', onClick: redo, disabled: !canRedo.value },
  { key: 'save', title: 'Save', ariaLabel: 'Save', icon: 'save', onClick: () => emit('save') }
])

const modeSwitchActions = computed<ToolbarAction[]>(() => [
  { key: 'mode-editor', title: 'Editor', ariaLabel: 'Editor', icon: 'edit_note', active: editorMode.value === 'editor', onClick: () => setMode('editor') },
  { key: 'mode-split', title: 'Split', ariaLabel: 'Split', icon: 'split_scene', active: editorMode.value === 'split', onClick: () => setMode('split') },
  { key: 'mode-preview', title: 'Preview', ariaLabel: 'Preview', icon: 'preview', active: editorMode.value === 'preview', onClick: () => setMode('preview') },
  { key: 'mode-reading', title: 'Reading', ariaLabel: 'Reading', icon: 'menu_book', onClick: () => setMode('reading') }
])

function readReadingThemePref(): ReadingTheme {
  const value = readString(READING_THEME_KEY)
  if (value === 'white' || value === 'paper' || value === 'dark') return value
  return 'white'
}

function readReadingFontSizePref(): number {
  const raw = Number(readString(READING_FONT_SIZE_KEY) || '19')
  if (!Number.isFinite(raw)) return 18
  return Math.max(READING_FONT_MIN, Math.min(READING_FONT_MAX, Math.round(raw)))
}

watch(
  () => props.modelValue,
  (value) => {
    if (value === markdownValue.value) return
    markdownValue.value = value
    if (history.isApplying()) return
    history.reset(value)
  },
  { flush: 'sync' }
)

watch(editorMode, (value) => {
  if (value !== 'reading') {
    lastNonReadingMode.value = value
  }
  writeEditorModePref(value)
  emit('mode-change', value)
  wikilink.close()
  editorFind.closeFind()
  void refreshPreview()
})

watch(markdownValue, () => {
  void refreshPreview()
})

watch(readingTheme, (value) => {
  writeString(READING_THEME_KEY, value)
})

watch(readingFontSize, (value) => {
  writeString(READING_FONT_SIZE_KEY, String(value))
})

watch(
  () => themeStore.isDark,
  async () => {
    await nextTick()
    await renderPreviewDiagrams()
  }
)

watch(editorMode, (mode) => {
  if (mode === 'reading') {
    annotationsVisible.value = false
    void fetchAnnotations().then(() => {
      void nextTick().then(() => applyAnnotationHighlights())
    })
  } else {
    clearAnnotationHighlights()
    annotationsVisible.value = false
  }
})

function applyValue(value: string, options?: { keepHistory?: boolean }) {
  markdownValue.value = value
  emit('update:modelValue', value)
  if (!options?.keepHistory) history.push(value)
}

function setMode(mode: EditorMode) {
  editorMode.value = mode
}

function exitReadingMode() {
  setMode(lastNonReadingMode.value === 'reading' ? 'preview' : lastNonReadingMode.value)
}

function undo() {
  const value = history.undo()
  if (value === null) return
  markdownValue.value = value
  emit('update:modelValue', value)
}

function redo() {
  const value = history.redo()
  if (value === null) return
  markdownValue.value = value
  emit('update:modelValue', value)
}

function applySelection(transform: (selected: string) => { text: string; cursorOffset?: number }) {
  const el = getEditorElement()
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = markdownValue.value.slice(start, end)
  const { text, cursorOffset } = transform(selected)
  const nextValue = markdownValue.value.slice(0, start) + text + markdownValue.value.slice(end)
  applyValue(nextValue)

  nextTick(() => {
    const nextPos = start + (cursorOffset ?? text.length)
    el.focus()
    el.setSelectionRange(nextPos, nextPos)
    refreshWikilinkSuggestions()
  })
}

function wrapSelection(prefix: string, suffix: string, fallback = 'text') {
  applySelection((selected) => {
    const content = selected || fallback
    const text = `${prefix}${content}${suffix}`
    return { text, cursorOffset: selected ? text.length : prefix.length + fallback.length }
  })
}

function insertLinePrefix(prefix: string, fallback = 'item') {
  applySelection((selected) => {
    if (!selected) {
      const text = `${prefix}${fallback}`
      return { text, cursorOffset: text.length }
    }
    const text = selected
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n')
    return { text, cursorOffset: text.length }
  })
}

function insertText(text: string) {
  applySelection(() => ({ text, cursorOffset: text.length }))
}

function applyHeading(level: number) {
  insertLinePrefix(`${'#'.repeat(level)} `, `Heading ${level}`)
}

function applyTableSize(cols: number, rows: number) {
  const head = `| ${Array.from({ length: cols }, (_, idx) => `Col ${idx + 1}`).join(' | ')} |\n`
  const sep = `|${Array.from({ length: cols }, () => '---').join('|')}|\n`
  const body = Array.from({ length: rows - 1 }, (_, r) => `| ${Array.from({ length: cols }, (_, c) => `R${r + 1}C${c + 1}`).join(' | ')} |\n`).join('')
  insertText(`\n${head}${sep}${body}`)
}

function applyEmoji(emoji: string) {
  insertText(emoji)
}

function insertCurrentDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  insertText(`${year}-${month}-${day}`)
}

function formatMarkdownTableAtCursor() {
  wikilink.close()
  const el = getEditorElement()
  if (!el) return
  const cursor = Math.min(el.selectionStart, el.selectionEnd)
  const result = formatPipeTableAtCursor(markdownValue.value, cursor)
  if (!result) return
  applyValue(result.text)
  nextTick(() => {
    el.focus()
    el.setSelectionRange(result.cursor, result.cursor)
    refreshWikilinkSuggestions()
  })
}

function continueListOnEnter(): boolean {
  const el = getEditorElement()
  if (!el) return false
  if (el.selectionStart !== el.selectionEnd) return false

  const pos = el.selectionStart
  const src = markdownValue.value
  const lineStart = src.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  const nextNl = src.indexOf('\n', pos)
  const lineEnd = nextNl === -1 ? src.length : nextNl
  const before = src.slice(lineStart, pos)
  const after = src.slice(pos, lineEnd)
  if (after.trim().length > 0) return false

  const task = before.match(/^(\s*)([-*+])\s\[( |x|X)\]\s(.*)$/)
  if (task) {
    const [, indent, bullet, state, text] = task
    if (!text.trim()) {
      const next = `${src.slice(0, lineStart)}${src.slice(lineEnd + 1)}`
      applyValue(next)
      nextTick(() => {
        const p = lineStart
        el.setSelectionRange(p, p)
      })
      return true
    }
    const insert = `\n${indent}${bullet} [${state === ' ' ? ' ' : ' '}] `
    applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
    nextTick(() => {
      const p = pos + insert.length
      el.setSelectionRange(p, p)
    })
    return true
  }

  const ordered = before.match(/^(\s*)(\d+)\.\s(.*)$/)
  if (ordered) {
    const [, indent, numRaw, text] = ordered
    if (!text.trim()) {
      const next = `${src.slice(0, lineStart)}${src.slice(lineEnd + 1)}`
      applyValue(next)
      nextTick(() => {
        const p = lineStart
        el.setSelectionRange(p, p)
      })
      return true
    }
    const insert = `\n${indent}${Number(numRaw) + 1}. `
    applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
    nextTick(() => {
      const p = pos + insert.length
      el.setSelectionRange(p, p)
    })
    return true
  }

  const bullet = before.match(/^(\s*)([-*+])\s(.*)$/)
  if (bullet) {
    const [, indent, marker, text] = bullet
    if (!text.trim()) {
      const next = `${src.slice(0, lineStart)}${src.slice(lineEnd + 1)}`
      applyValue(next)
      nextTick(() => {
        const p = lineStart
        el.setSelectionRange(p, p)
      })
      return true
    }
    const insert = `\n${indent}${marker} `
    applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
    nextTick(() => {
      const p = pos + insert.length
      el.setSelectionRange(p, p)
    })
    return true
  }

  return false
}

function refreshWikilinkSuggestions() {
  void wikilink.refresh()
}

function cancelWikilinkBlur() {
  if (wikilinkBlurTimer !== undefined) {
    clearTimeout(wikilinkBlurTimer)
    wikilinkBlurTimer = undefined
  }
}

function onEditorBlur() {
  cancelWikilinkBlur()
  wikilinkBlurTimer = setTimeout(() => wikilink.close(), 120)
}

function openEditorFind() {
  cancelWikilinkBlur()
  wikilink.close()
  editorFind.openFind()
}

function applyWikilinkSuggestion(index: number) {
  cancelWikilinkBlur()
  const item = wikilink.selectIndex(index)
  if (!item) return
  const el = getEditorElement()
  if (!el) return
  const titleSlug = normalizePageSlug(item.title)
  const inner = item.slug === titleSlug ? item.title : `${item.slug}|${item.title}`
  const replacement = `[[${inner}]]`
  const start = wikilink.from.value
  const end = wikilink.to.value
  const next = markdownValue.value.slice(0, start) + replacement + markdownValue.value.slice(end)
  applyValue(next)
  wikilink.close()
  nextTick(() => {
    const pos = start + replacement.length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function onEditorInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  applyValue(target.value)
  refreshWikilinkSuggestions()
}

function onEditorKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    openEditorFind()
    return
  }
  if (editorFind.handleKeydown(event)) return
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('save')
    return
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
    return
  }
  if ((event.metaKey || event.ctrlKey) && ((event.shiftKey && event.key.toLowerCase() === 'z') || event.key.toLowerCase() === 'y')) {
    event.preventDefault()
    redo()
    return
  }
  if (wikilink.open.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      wikilink.moveDown()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      wikilink.moveUp()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      applyWikilinkSuggestion(wikilink.selected.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      wikilink.close()
      return
    }
  }
  if (event.key === 'Enter' && continueListOnEnter()) {
    event.preventDefault()
  }
}

async function onUploadFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  uploadError.value = ''
  try {
    const urls = await Promise.all(
      Array.from(files).map(async (file) => {
        const { data } = await uploadAttachment(file)
        return data.url
      })
    )
    const text = urls.map((url) => `![image](${url})`).join('\n')
    insertText(text)
  } catch (error) {
    uploadError.value = getApiErrorMessage(error, t.errors.imageUploadFailed)
  } finally {
    if (uploadInput.value) uploadInput.value.value = ''
  }
}

function triggerUpload() {
  uploadInput.value?.click()
}

function onEditorScroll() {
  if (editorMode.value !== 'split') return
  splitScrollSync.syncEditorToPreview()
  wikilink.updatePosition()
}

function getEditorElement(): HTMLTextAreaElement | null {
  return editorRef.value?.textareaEl ?? null
}

function getPreviewPaneElement(): HTMLElement | null {
  return previewPaneRef.value?.rootEl ?? null
}

function getPreviewContentElement(): HTMLElement | null {
  const root = getPreviewPaneElement()
  return root?.querySelector<HTMLElement>('.preview-content.markdown-body') ?? null
}

async function exportToPdf() {
  if (exportingPdf.value) return
  exportingPdf.value = true
  const previousMode = editorMode.value
  try {
    if (previousMode === 'editor') {
      setMode('preview')
      await nextTick()
      await refreshPreview()
      await nextTick()
    } else {
      await renderPreviewDiagrams()
      await nextTick()
    }

    const content = getPreviewContentElement()
    if (!content) {
      await dialog.alert(t.export.pdfNoPreview)
      return
    }

    await downloadPagePdf({
      title: props.readingTitle || 'Untitled',
      contentElement: content
    })
  } catch (error) {
    await dialog.alert(getApiErrorMessage(error, t.export.pdfFailed))
  } finally {
    if (previousMode === 'editor') {
      setMode(previousMode)
    }
    exportingPdf.value = false
  }
}

function onPreviewScroll() {
  if (editorMode.value !== 'split') return
  splitScrollSync.syncPreviewToEditor()
}

function startSplitDrag(event: MouseEvent) {
  if (editorMode.value !== 'split') return
  const shell = splitShellRef.value
  if (!shell) return
  const rect = shell.getBoundingClientRect()
  startResizeDrag(event, {
    onStart: () => {
      splitDragging.value = true
    },
    onMove: (moveEvent) => {
      const raw = ((moveEvent.clientX - rect.left) / rect.width) * 100
      splitRatio.value = clampSplitRatio(raw)
      writeSplitRatioPref(splitRatio.value)
    },
    onEnd: () => {
      splitDragging.value = false
    }
  })
}

function resetSplitRatio() {
  splitRatio.value = DEFAULT_SPLIT_RATIO
  writeSplitRatioPref(DEFAULT_SPLIT_RATIO)
}

async function renderPreviewDiagrams() {
  await previewRenderPipeline.renderPreviewBase()
  previewCopyDecorations.decorateHeadingAnchors()
  previewCopyDecorations.decorateCodeCopyButtons()
  readingToc.buildReadingToc()
  if (editorMode.value === 'reading') {
    applyAnnotationHighlights()
  }
}

async function refreshPreview() {
  const token = ++previewRenderToken
  if (editorMode.value === 'editor') {
    previewHtml.value = ''
    return
  }
  const renderer = await getMarkdownRenderer()
  if (token !== previewRenderToken) return
  previewHtml.value = renderer.render(markdownValue.value)
  await nextTick()
  if (token !== previewRenderToken) return
  await renderPreviewDiagrams()
}

async function onPreviewClick(event: MouseEvent) {
  await previewCopyDecorations.onPreviewClick(event)
}

function getPageSlugFromUrl(): string | null {
  const path = window.location.pathname
  const match = path.match(/^\/page\/(.+)/)
  return match ? match[1] : null
}

async function fetchAnnotations() {
  const slug = getPageSlugFromUrl()
  if (!slug) return
  try {
    const { data } = await listAnnotations(slug)
    annotations.value = data
  } catch {
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
  const container = getPreviewContentElement()
  if (!container) return

  for (const annotation of annotations.value) {
    const text = annotation.highlightedText
    if (!text) continue
    const color = annotation.color || '#ffeb3b'
    highlightTextInNode(container, text, color)
  }
}

function highlightTextInNode(root: HTMLElement, searchText: string, color: string) {
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
    markEl.textContent = match
    const afterNode = document.createTextNode(after)

    annotationHighlightSpans.push(markEl)
    parent.insertBefore(beforeNode, textNode)
    parent.insertBefore(markEl, textNode)
    parent.insertBefore(afterNode, textNode)
    parent.removeChild(textNode)
    break
  }
}

function onReadingMouseUp() {
  if (editorMode.value !== 'reading') return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    floatingBtn.value = null
    pendingAnnotation.value = null
    return
  }
  const selectedText = sel.toString().trim()
  const container = getPreviewContentElement()
  const fullText = container?.textContent || ''
  const idx = fullText.indexOf(selectedText)
  const ctxStart = Math.max(0, idx - 40)
  const ctxEnd = Math.min(fullText.length, idx + selectedText.length + 40)
  pendingAnnotation.value = { text: selectedText, context: fullText.slice(ctxStart, ctxEnd) }
  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  floatingBtn.value = {
    x: rect.left + rect.width / 2 - 60,
    y: rect.top - 36
  }
}

function onReadingMouseDown() {
  floatingBtn.value = null
  pendingAnnotation.value = null
}

function onReadingTouchEnd() {
  setTimeout(() => {
    if (editorMode.value !== 'reading') return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      floatingBtn.value = null
      return
    }
    const selectedText = sel.toString().trim()
    const container = getPreviewContentElement()
    const fullText = container?.textContent || ''
    const idx = fullText.indexOf(selectedText)
    const ctxStart = Math.max(0, idx - 40)
    const ctxEnd = Math.min(fullText.length, idx + selectedText.length + 40)
    pendingAnnotation.value = { text: selectedText, context: fullText.slice(ctxStart, ctxEnd) }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    floatingBtn.value = {
      x: rect.left + rect.width / 2 - 60,
      y: rect.top - 36
    }
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
    const container = getPreviewContentElement()
    const fullText = container?.textContent || ''
    const idx = fullText.indexOf(selectedText)
    const ctxStart = Math.max(0, idx - 40)
    const ctxEnd = Math.min(fullText.length, idx + selectedText.length + 40)
    anchorContext = fullText.slice(ctxStart, ctxEnd)
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

onMounted(() => {
  emit('mode-change', editorMode.value)
  void getPages()
  void refreshPreview()
})

onBeforeUnmount(() => {
  cancelWikilinkBlur()
  clearDragListeners()
})

defineExpose({
  exportToPdf,
  exportingPdf
})
</script>

<template>
  <div
    class="markdown-editor-wrapper"
    :class="{
      dark: themeStore.isDark,
      'reading-mode': editorMode === 'reading',
      'reading-theme-white': editorMode === 'reading' && readingTheme === 'white',
      'reading-theme-paper': editorMode === 'reading' && readingTheme === 'paper',
      'reading-theme-dark': editorMode === 'reading' && readingTheme === 'dark'
    }"
  >
    <div class="toolbar">
      <template v-if="editorMode === 'reading'">
        <ReadingToolbar
          :title="props.readingTitle"
          :font-size="readingFontSize"
          :font-min="READING_FONT_MIN"
          :font-max="READING_FONT_MAX"
          :theme="readingTheme"
          :toc-visible="readingTocVisible"
          :annotations-visible="annotationsVisible"
          @update:font-size="readingFontSize = $event"
          @update:theme="readingTheme = $event"
          @update:toc-visible="readingTocVisible = $event"
          @update:annotations-visible="annotationsVisible = $event"
          @exit="exitReadingMode"
          @export-pdf="exportToPdf"
        />
      </template>
      <template v-else>
        <EditorToolbar
          :inline-format-actions="inlineFormatActions"
          :list-and-block-actions="listAndBlockActions"
          :quick-insert-actions="quickInsertActions"
          :history-actions="historyActions"
          :mode-switch-actions="modeSwitchActions"
          :emoji-items="emojiItems"
          :on-apply-heading="applyHeading"
          :on-apply-table-size="applyTableSize"
          :on-apply-emoji="applyEmoji"
        />
      </template>
    </div>
    <div ref="splitShellRef" class="editor-shell" :class="`mode-${editorMode}`" :style="editorShellStyle">
      <EditorInputPane
        v-if="editorMode === 'editor' || editorMode === 'split'"
        ref="editorRef"
        :model-value="markdownValue"
        :wikilink-open="wikilinkOpen"
        :wikilink-items="wikilinkItems"
        :wikilink-selected="wikilinkSelected"
        :wikilink-menu-style="wikilinkMenuStyle"
        :find-open="findBarOpen"
        :find-query="findBarQuery"
        :find-status-label="findBarStatusLabel"
        @input="onEditorInput"
        @keydown="onEditorKeydown"
        @click="refreshWikilinkSuggestions"
        @keyup="refreshWikilinkSuggestions"
        @scroll="onEditorScroll"
        @blur="onEditorBlur"
        @select-wikilink="applyWikilinkSuggestion"
        @update:find-query="editorFind.query.value = $event; editorFind.refreshMatches()"
        @find-next="editorFind.findNext()"
        @find-prev="editorFind.findPrev()"
        @find-close="editorFind.closeFind()"
      />
      <VerticalPaneResizer
        v-if="editorMode === 'split' && !isMobile"
        :dragging="splitDragging"
        ariaLabel="Resize split panes"
        @mousedown="startSplitDrag"
        @dblclick="resetSplitRatio"
      />
      <div
        v-if="editorMode === 'reading' && annotationsVisible"
        class="reading-with-annotations"
      >
        <EditorPreviewPane
          ref="previewPaneRef"
          :is-reading="true"
          :reading-theme="readingTheme"
          :show-toc="previewHasToc"
          :reading-toc-items="readingTocItems"
          :preview-html="previewHtml"
          :reading-preview-style="readingPreviewStyle"
          @click="onPreviewClick"
          @scroll="onPreviewScroll"
          @select-heading="readingToc.scrollToHeading"
          @mouseup="onReadingMouseUp"
          @mousedown="onReadingMouseDown"
          @touchend="onReadingTouchEnd"
        />
        <AnnotationPanel
          :annotations="annotations"
          :visible="annotationsVisible"
          @update:visible="annotationsVisible = $event"
          @deleted="onAnnotationDeleted"
        />
      </div>
      <EditorPreviewPane
        v-else-if="editorMode !== 'editor'"
        ref="previewPaneRef"
        :is-reading="editorMode === 'reading'"
        :reading-theme="readingTheme"
        :show-toc="previewHasToc"
        :reading-toc-items="readingTocItems"
        :preview-html="previewHtml"
        :reading-preview-style="readingPreviewStyle"
        @click="onPreviewClick"
        @scroll="onPreviewScroll"
        @select-heading="readingToc.scrollToHeading"
        @mouseup="onReadingMouseUp"
        @mousedown="onReadingMouseDown"
        @touchend="onReadingTouchEnd"
      />
    </div>
    <input
      ref="uploadInput"
      type="file"
      accept="image/*"
      class="visually-hidden"
      multiple
      @change="onUploadFiles(($event.target as HTMLInputElement).files)"
    />
    <p v-if="uploadError" class="upload-error">
      {{ uploadError }}
    </p>
    <button
      v-if="floatingBtn"
      type="button"
      class="annotation-floating-btn"
      :style="{ left: floatingBtn.x + 'px', top: floatingBtn.y + 'px' }"
      @click.stop="startAnnotation"
    >
      <span class="material-symbols-outlined notranslate" translate="no">chat_bubble</span>
      Add annotation
    </button>
    <AnnotationPopup
      v-if="annotationPopup"
      :selected-text="annotationPopup.selectedText"
      :anchor-context="annotationPopup.anchorContext"
      :x="annotationPopup.x"
      :y="annotationPopup.y"
      @close="annotationPopup = null"
      @created="onAnnotationCreated"
    />
  </div>
</template>

<style scoped>
.markdown-editor-wrapper {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.markdown-editor-wrapper.reading-mode {
  gap: 0;
}

.markdown-editor-wrapper.reading-theme-white {
  --color-bg: #ffffff;
  --color-bg-secondary: #f6f8fb;
  --color-bg-hover: #edf2f8;
  --color-border: #d3dce7;
  --color-text: #1f2937;
  --color-text-muted: #5f6f84;
  --color-text-faint: #8a96a6;
  --color-wikilink: #2563a8;
  --color-tag: #a26a16;
}

.markdown-editor-wrapper.reading-theme-paper {
  --color-bg: #f6f1e3;
  --color-bg-secondary: #efe6d3;
  --color-bg-hover: #e7dbc1;
  --color-border: #d8cbb3;
  --color-text: #2d2a22;
  --color-text-muted: #6d624d;
  --color-text-faint: #8c816c;
  --color-wikilink: #5f4bb6;
  --color-tag: #946a14;
}

.markdown-editor-wrapper.reading-theme-dark {
  --color-bg: #0f1115;
  --color-bg-secondary: #171b22;
  --color-bg-hover: #212734;
  --color-border: #2b3442;
  --color-text: #e7ecf3;
  --color-text-muted: #9ca8bb;
  --color-text-faint: #76859c;
  --color-wikilink: #8ac5ff;
  --color-tag: #f4bf73;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 8px;
}

.reading-mode .toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  border-radius: 0;
}

.editor-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 0;
}

.editor-shell.mode-editor {
  grid-template-columns: minmax(0, 1fr);
}

.editor-shell.mode-preview {
  grid-template-columns: minmax(0, 1fr);
}

.editor-shell.mode-reading {
  grid-template-columns: minmax(0, 1fr);
}

.editor-shell.mode-split {
  grid-template-columns: 1fr 8px minmax(0, 1fr);
}

@media (max-width: 767px) {
  .toolbar {
    padding: 6px;
    gap: 4px;
  }

  .reading-mode .toolbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    padding: 6px 10px;
  }

  .editor-shell.mode-split {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .toolbar {
    padding: 6px;
  }
}

.markdown-editor-wrapper.reading-theme-white .toolbar,
.markdown-editor-wrapper.reading-theme-white :deep(.preview-pane.reading-theme-white) {
  background: #ffffff;
}

.markdown-editor-wrapper.reading-theme-paper .toolbar,
.markdown-editor-wrapper.reading-theme-paper :deep(.preview-pane.reading-theme-paper) {
  background: #f6f1e3;
}

.markdown-editor-wrapper.reading-theme-dark .toolbar,
.markdown-editor-wrapper.reading-theme-dark :deep(.preview-pane.reading-theme-dark) {
  background: #0f1115;
  color: #e7ecf3;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body) {
  color: var(--color-text);
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h1),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h2),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h3),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h4),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h5),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body h6) {
  color: #f7fbff;
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .wikilink),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .mdlink-internal) {
  color: #8ac5ff;
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .wikilink-missing),
.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .mdlink-internal-missing) {
  color: #fbbf24;
  background: color-mix(in srgb, #fbbf24 14%, transparent);
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .external-link) {
  color: #a8b4c4;
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body .hashtag) {
  color: #f4bf73;
  background: color-mix(in srgb, #f4bf73 15%, transparent);
  border-color: color-mix(in srgb, #f4bf73 25%, transparent);
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body code:not(pre code)) {
  background: #273243;
  color: #f5fbff;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body pre code.hljs) {
  background: #f6f8fa;
  color: #24292f;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-comment),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-quote) {
  color: #5f6b78;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-keyword),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-selector-tag),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-subst) {
  color: #9b1c31;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-number),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-literal),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-variable),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-template-variable),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-tag .hljs-attr) {
  color: #0f4f96;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-string),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-doctag) {
  color: #23631c;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-title),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-section),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-selector-id) {
  color: #6f42c1;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-type),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-class .hljs-title) {
  color: #7f5b0a;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-tag),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-name),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-attribute) {
  color: #176236;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-regexp),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-link) {
  color: #0d4f77;
}

.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-built_in),
.markdown-editor-wrapper.reading-theme-white :deep(.markdown-body .hljs-builtin-name) {
  color: #8a3f05;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body pre code.hljs) {
  background: #efe7d6;
  color: #2d2a22;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-comment),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-quote) {
  color: #7b6f5a;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-keyword),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-selector-tag),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-subst) {
  color: #813232;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-number),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-literal),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-variable),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-template-variable),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-tag .hljs-attr) {
  color: #1f4f88;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-string),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-doctag) {
  color: #2f6f26;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-title),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-section),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-selector-id) {
  color: #5f3f96;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-type),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-class .hljs-title) {
  color: #7a5d22;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-tag),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-name),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-attribute) {
  color: #225b32;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-regexp),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-link) {
  color: #2b5974;
}

.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-built_in),
.markdown-editor-wrapper.reading-theme-paper :deep(.markdown-body .hljs-builtin-name) {
  color: #7d401f;
}

.markdown-editor-wrapper.reading-theme-dark :deep(.markdown-body pre code.hljs) {
  background: #272822;
  color: #f8f8f2;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;
  clip: rect(0 0 0 0);
  overflow: hidden;
}

.upload-error {
  position: absolute;
  left: 12px;
  bottom: 10px;
  z-index: 25;
  margin: 0;
  color: #d14343;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #f3b6b6;
  border-radius: 4px;
  padding: 6px 8px;
}

:deep(.markdown-body > *:first-child) {
  margin-top: 0;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5) {
  margin: 1rem 0 0.55rem;
}

:deep(.markdown-body p),
:deep(.markdown-body ul),
:deep(.markdown-body ol),
:deep(.markdown-body pre),
:deep(.markdown-body table),
:deep(.markdown-body blockquote) {
  margin: 0.55rem 0;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 1.1rem;
}

:deep(.markdown-body ol) {
  padding-left: 1.6rem;
}

:deep(.markdown-body li) {
  line-height: 1.9;
  margin: 0.18rem 0;
}

:deep(.markdown-body code) {
  font-family: var(--font-mono);
}

:deep(.markdown-body code:not(pre code)) {
  background: color-mix(in srgb, var(--color-bg-secondary) 88%, var(--color-border));
  color: var(--color-text);
  border-radius: 4px;
  padding: 0.08em 0.36em;
}

:deep(.markdown-body pre) {
  overflow: auto;
  border-radius: 8px;
  position: relative;
}

:deep(.markdown-body pre code.hljs) {
  display: block;
  padding: 12px 42px 12px 12px;
  border-radius: inherit;
}

:deep(.markdown-body .task-list-item) {
  list-style: none;
  padding-left: 0;
}

:deep(.markdown-body .task-list-item input[type='checkbox']) {
  width: 16px;
  min-width: 16px;
  height: 16px;
  margin: 0.22rem 0.55rem 0 0;
  vertical-align: top;
}

:deep(.markdown-body .wikilink),
:deep(.markdown-body .mdlink-internal) {
  color: var(--color-wikilink);
  text-decoration: underline;
  text-decoration-style: dotted;
}

:deep(.markdown-body .wikilink-missing),
:deep(.markdown-body .mdlink-internal-missing) {
  color: var(--color-wikilink-missing);
}

:deep(.markdown-body .external-link) {
  color: var(--color-external-link);
  text-decoration: underline;
  text-decoration-style: solid;
}

:deep(.markdown-body .hashtag) {
  color: var(--color-tag);
  font-weight: 500;
}

:deep(.markdown-body .heading-anchor) {
  margin-left: 0;
  font-size: 0.9em;
  color: inherit;
  text-decoration: none;
  opacity: 1;
}

:deep(.markdown-body .heading-copy-btn) {
  width: 22px;
  min-width: 22px;
  height: 22px;
  min-height: 22px;
  margin-left: 0.2rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-faint);
  opacity: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

:deep(.markdown-body .heading-copy-btn .material-symbols-outlined) {
  font-size: 17px;
  line-height: 1;
}

:deep(.markdown-body h1:hover .heading-anchor),
:deep(.markdown-body h2:hover .heading-anchor),
:deep(.markdown-body h3:hover .heading-anchor),
:deep(.markdown-body h4:hover .heading-anchor),
:deep(.markdown-body h5:hover .heading-anchor),
:deep(.markdown-body h6:hover .heading-anchor) {
  opacity: 1;
}

:deep(.markdown-body h1:hover .heading-copy-btn),
:deep(.markdown-body h2:hover .heading-copy-btn),
:deep(.markdown-body h3:hover .heading-copy-btn),
:deep(.markdown-body h4:hover .heading-copy-btn),
:deep(.markdown-body h5:hover .heading-copy-btn),
:deep(.markdown-body h6:hover .heading-copy-btn) {
  opacity: 1;
}

:deep(.markdown-body .heading-copy-btn:hover) {
  border-color: var(--color-border);
  background: var(--color-bg-hover);
}

:deep(.markdown-body .heading-copy-btn.copied) {
  opacity: 1;
  color: var(--color-success);
}

:deep(.markdown-body .heading-copy-btn.failed) {
  opacity: 1;
  color: var(--color-danger);
}

:deep(.markdown-body .code-copy-btn) {
  width: 24px;
  min-width: 24px;
  height: 24px;
  min-height: 24px;
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-faint);
  opacity: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.markdown-body .code-copy-btn .material-symbols-outlined) {
  font-size: 16px;
  line-height: 1;
}

:deep(.markdown-body pre:hover .code-copy-btn) {
  opacity: 1;
}

:deep(.markdown-body .code-copy-btn:hover) {
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
}

:deep(.markdown-body .code-copy-btn.copied) {
  opacity: 1;
  color: var(--color-success);
}

:deep(.markdown-body .code-copy-btn.failed) {
  opacity: 1;
  color: var(--color-danger);
}

:deep(.markdown-body .mermaid) {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

:deep(.markdown-body .mermaid svg) {
  max-width: 100%;
  height: auto;
}

:deep(.markdown-body .structurizr) {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

:deep(.markdown-body .structurizr svg) {
  max-width: 100%;
  height: auto;
}

.reading-with-annotations {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.reading-with-annotations :deep(.preview-pane) {
  flex: 1;
  min-width: 0;
}

.annotation-floating-btn {
  position: fixed;
  z-index: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  transition: transform 0.1s;
}

.annotation-floating-btn:hover {
  transform: scale(1.05);
}

.annotation-floating-btn .material-symbols-outlined {
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 768px) {
  .annotation-floating-btn {
    padding: 10px 18px;
    font-size: 14px;
    border-radius: 10px;
    transform: translateX(-50%);
    left: 50% !important;
    top: 20px !important;
  }
}

:deep(.annotation-highlight) {
  cursor: pointer;
  transition: filter 0.15s;
}

:deep(.annotation-highlight:hover) {
  filter: brightness(0.85);
}
</style>
