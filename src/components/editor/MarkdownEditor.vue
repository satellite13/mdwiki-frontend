<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import mermaid from 'mermaid'
import { useThemeStore } from '@/stores/theme'
import { uploadAttachment } from '@/api/attachments'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import { useEditorHistory } from '@/composables/useEditorHistory'
import { useWikilinkAutocomplete } from '@/composables/useWikilinkAutocomplete'
import { normalizePageSlug } from '@/utils/pageSlug'
import { formatPipeTableAtCursor } from '@/utils/formatMarkdownTable'
import { createMarkdownRenderer } from './markdown'
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  readEditorModePref,
  readSplitRatioPref,
  writeEditorModePref,
  writeSplitRatioPref,
  type EditorMode
} from './editorPreferences'

const TABLE_GRID_MAX = 8

const EMOJI_ITEMS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '🙂', '😉', '😍', '😘', '😗', '😚', '😋', '😎',
  '🤩', '🤔', '🫠', '😐', '😑', '🙄', '😴', '🤯',
  '🥳', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥',
  '✨', '💡', '🎯', '✅', '❌', '⚠️', '🚀', '📌',
  '📎', '📷', '🧠', '🔧', '📝', '💬', '🌟', '💯'
]

const md = createMarkdownRenderer()

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

const uploadError = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)
const editorRef = ref<HTMLTextAreaElement | null>(null)
const splitShellRef = ref<HTMLElement | null>(null)
const previewPaneRef = ref<HTMLElement | null>(null)
const headingMenuRef = ref<HTMLElement | null>(null)
const tableMenuRef = ref<HTMLElement | null>(null)
const emojiMenuRef = ref<HTMLElement | null>(null)

const editorMode = ref<EditorMode>(readEditorModePref())
const splitRatio = ref(readSplitRatioPref())
const splitDragging = ref(false)
const markdownValue = ref(props.modelValue)

const history = useEditorHistory(props.modelValue)

const headingMenuOpen = ref(false)
const tableMenuOpen = ref(false)
const emojiMenuOpen = ref(false)
const tableHoverCols = ref(1)
const tableHoverRows = ref(1)
const lastNonReadingMode = ref<EditorMode>('split')

const wikilink = useWikilinkAutocomplete({
  getEditor: () => editorRef.value,
  getSource: () => markdownValue.value,
  getContainerRect: () => splitShellRef.value?.getBoundingClientRect() ?? null
})
const wikilinkOpen = wikilink.open
const wikilinkItems = wikilink.items
const wikilinkSelected = wikilink.selected
const wikilinkMenuStyle = wikilink.menuStyle

let suppressEditorScrollUntil = 0
let suppressPreviewScrollUntil = 0
let pointerMoveHandler: ((event: MouseEvent) => void) | null = null
let pointerUpHandler: (() => void) | null = null
const copyFeedbackTimers = new WeakMap<HTMLButtonElement, number>()

const previewHtml = computed(() => md.render(markdownValue.value))
const canUndo = history.canUndo
const canRedo = history.canRedo
const emojiItems = computed(() => EMOJI_ITEMS)
const editorShellStyle = computed(() =>
  editorMode.value === 'split'
    ? { gridTemplateColumns: `${splitRatio.value}% 8px minmax(0, 1fr)` }
    : undefined
)

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
  closeAllMenus()
  wikilink.close()
  nextTick(() => {
    void renderMermaid()
  })
})

watch(previewHtml, async () => {
  await nextTick()
  await renderMermaid()
})

watch(
  () => themeStore.isDark,
  async () => {
    await nextTick()
    await renderMermaid()
  }
)

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
  const el = editorRef.value
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
  headingMenuOpen.value = false
  insertLinePrefix(`${'#'.repeat(level)} `, `Heading ${level}`)
}

function setTableHover(cols: number, rows: number) {
  tableHoverCols.value = cols
  tableHoverRows.value = rows
}

function applyTableSize(cols: number, rows: number) {
  tableMenuOpen.value = false
  const head = `| ${Array.from({ length: cols }, (_, idx) => `Col ${idx + 1}`).join(' | ')} |\n`
  const sep = `|${Array.from({ length: cols }, () => '---').join('|')}|\n`
  const body = Array.from({ length: rows - 1 }, (_, r) => `| ${Array.from({ length: cols }, (_, c) => `R${r + 1}C${c + 1}`).join(' | ')} |\n`).join('')
  insertText(`\n${head}${sep}${body}`)
}

function applyEmoji(emoji: string) {
  emojiMenuOpen.value = false
  insertText(emoji)
}

function toggleHeadingMenu() {
  headingMenuOpen.value = !headingMenuOpen.value
  tableMenuOpen.value = false
  emojiMenuOpen.value = false
}

function toggleTableMenu() {
  tableMenuOpen.value = !tableMenuOpen.value
  headingMenuOpen.value = false
  emojiMenuOpen.value = false
}

function formatMarkdownTableAtCursor() {
  closeAllMenus()
  const el = editorRef.value
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

function toggleEmojiMenu() {
  emojiMenuOpen.value = !emojiMenuOpen.value
  headingMenuOpen.value = false
  tableMenuOpen.value = false
}

function closeAllMenus() {
  headingMenuOpen.value = false
  tableMenuOpen.value = false
  emojiMenuOpen.value = false
}

function continueListOnEnter(): boolean {
  const el = editorRef.value
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

function applyWikilinkSuggestion(index: number) {
  const item = wikilink.selectIndex(index)
  if (!item) return
  const el = editorRef.value
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

function getSyncedScrollTop(source: HTMLElement, target: HTMLElement): number | null {
  const sourceMax = source.scrollHeight - source.clientHeight
  const targetMax = target.scrollHeight - target.clientHeight
  if (sourceMax <= 0 || targetMax <= 0) return null
  const ratio = source.scrollTop / sourceMax
  return ratio * targetMax
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function isSuppressed(side: 'editor' | 'preview') {
  const t = nowMs()
  return side === 'editor' ? t < suppressEditorScrollUntil : t < suppressPreviewScrollUntil
}

function suppressSide(side: 'editor' | 'preview', ms = 140) {
  const until = nowMs() + ms
  if (side === 'editor') {
    suppressEditorScrollUntil = Math.max(suppressEditorScrollUntil, until)
  } else {
    suppressPreviewScrollUntil = Math.max(suppressPreviewScrollUntil, until)
  }
}

function setScrollTopSilently(target: HTMLElement, nextTop: number, side: 'editor' | 'preview') {
  const current = target.scrollTop
  // Ignore tiny deltas to avoid endless micro-adjustment drift.
  if (Math.abs(current - nextTop) < 1.5) return
  suppressSide(side)
  target.scrollTop = nextTop
  requestAnimationFrame(() => suppressSide(side, 80))
}

function onEditorScroll() {
  if (editorMode.value !== 'split') return
  if (isSuppressed('editor')) return
  const editor = editorRef.value
  const preview = previewPaneRef.value
  if (!editor || !preview) return
  const nextTop = getSyncedScrollTop(editor, preview)
  if (nextTop !== null) setScrollTopSilently(preview, nextTop, 'preview')
  wikilink.updatePosition()
}

function onPreviewScroll() {
  if (editorMode.value !== 'split') return
  if (isSuppressed('preview')) return
  const editor = editorRef.value
  const preview = previewPaneRef.value
  if (!editor || !preview) return
  const nextTop = getSyncedScrollTop(preview, editor)
  if (nextTop !== null) setScrollTopSilently(editor, nextTop, 'editor')
}

function startSplitDrag(event: MouseEvent) {
  if (editorMode.value !== 'split') return
  const shell = splitShellRef.value
  if (!shell) return
  splitDragging.value = true
  const rect = shell.getBoundingClientRect()
  pointerMoveHandler = (moveEvent: MouseEvent) => {
    const raw = ((moveEvent.clientX - rect.left) / rect.width) * 100
    splitRatio.value = clampSplitRatio(raw)
    writeSplitRatioPref(splitRatio.value)
  }
  pointerUpHandler = () => {
    splitDragging.value = false
    if (pointerMoveHandler) window.removeEventListener('mousemove', pointerMoveHandler)
    if (pointerUpHandler) window.removeEventListener('mouseup', pointerUpHandler)
    pointerMoveHandler = null
    pointerUpHandler = null
  }
  window.addEventListener('mousemove', pointerMoveHandler)
  window.addEventListener('mouseup', pointerUpHandler)
  event.preventDefault()
}

function resetSplitRatio() {
  splitRatio.value = DEFAULT_SPLIT_RATIO
  writeSplitRatioPref(DEFAULT_SPLIT_RATIO)
}

function normalizeTableColumnAlignment() {
  const root = previewPaneRef.value
  if (!root) return
  const tables = root.querySelectorAll<HTMLTableElement>('table')
  tables.forEach((table) => {
    const headerCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
    if (!headerCells.length) return
    const columnAlignments = headerCells.map((th) => (th.style.textAlign || th.getAttribute('align') || '').trim())
    if (!columnAlignments.some(Boolean)) return
    const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr')
    rows.forEach((row) => {
      const cells = Array.from(row.children) as HTMLElement[]
      columnAlignments.forEach((align, idx) => {
        if (!align) return
        const cell = cells[idx]
        if (!cell) return
        cell.style.textAlign = align
      })
    })
  })
}

async function renderMermaid() {
  if (editorMode.value === 'editor') return
  const root = previewPaneRef.value
  if (!root) return
  mermaid.initialize({
    startOnLoad: false,
    theme: themeStore.isDark ? 'dark' : 'default',
    securityLevel: 'strict'
  })
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'))
  for (const node of nodes) {
    const source = node.dataset.source || node.textContent || ''
    if (!node.dataset.source) node.dataset.source = source
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
    try {
      const { svg } = await mermaid.render(id, source)
      node.innerHTML = svg
    } catch {
      // keep source code when render fails
    }
  }
  normalizeTableColumnAlignment()
  decorateHeadingAnchors()
}

function decorateHeadingAnchors() {
  const root = previewPaneRef.value
  if (!root) return
  const headings = root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
  headings.forEach((heading) => {
    if (heading.querySelector(':scope > .heading-copy-btn')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'heading-copy-btn'
    button.dataset.anchor = heading.id
    button.title = 'Скопировать якорь раздела'
    button.setAttribute('aria-label', 'Скопировать якорь раздела')
    button.innerHTML = '<span class="material-symbols-outlined notranslate" translate="no">content_copy</span>'
    heading.appendChild(button)
  })
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

async function onPreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const button = target?.closest<HTMLButtonElement>('.heading-copy-btn')
  if (!button) return
  event.preventDefault()
  event.stopPropagation()

  const anchor = button.dataset.anchor
  if (!anchor) return

  const link = `#${anchor}`
  const copied = await copyTextToClipboard(link)

  const previousTimer = copyFeedbackTimers.get(button)
  if (previousTimer) window.clearTimeout(previousTimer)
  button.classList.remove('copied', 'failed')
  button.classList.add(copied ? 'copied' : 'failed')
  button.title = copied ? 'Якорь скопирован' : 'Не удалось скопировать'
  const timer = window.setTimeout(() => {
    button.classList.remove('copied', 'failed')
    button.title = 'Скопировать якорь раздела'
  }, 1300)
  copyFeedbackTimers.set(button, timer)
}

function onGlobalClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (headingMenuRef.value && target && !headingMenuRef.value.contains(target)) headingMenuOpen.value = false
  if (tableMenuRef.value && target && !tableMenuRef.value.contains(target)) tableMenuOpen.value = false
  if (emojiMenuRef.value && target && !emojiMenuRef.value.contains(target)) emojiMenuOpen.value = false
}

onMounted(() => {
  emit('mode-change', editorMode.value)
  document.addEventListener('click', onGlobalClick)
  void renderMermaid()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onGlobalClick)
  if (pointerMoveHandler) window.removeEventListener('mousemove', pointerMoveHandler)
  if (pointerUpHandler) window.removeEventListener('mouseup', pointerUpHandler)
})
</script>

<template>
  <div class="markdown-editor-wrapper" :class="{ dark: themeStore.isDark, 'reading-mode': editorMode === 'reading' }">
    <div class="toolbar">
      <template v-if="editorMode === 'reading'">
        <router-link to="/" class="reading-logo">MDWiki</router-link>
        <div class="reading-title" :title="props.readingTitle || ''">{{ props.readingTitle || 'Untitled' }}</div>
        <button
          type="button"
          class="reading-exit-btn"
          title="Exit reading mode"
          aria-label="Exit reading mode"
          @click="exitReadingMode"
        >
          <span class="material-symbols-outlined notranslate" translate="no">close_fullscreen</span>
        </button>
      </template>
      <template v-else>
      <button type="button" class="icon-btn" title="Bold" aria-label="Bold" @click="wrapSelection('**', '**')"><span class="material-symbols-outlined notranslate" translate="no">format_bold</span></button>
      <button type="button" class="icon-btn" title="Italic" aria-label="Italic" @click="wrapSelection('*', '*')"><span class="material-symbols-outlined notranslate" translate="no">format_italic</span></button>
      <button type="button" class="icon-btn" title="Underline" aria-label="Underline" @click="wrapSelection('<u>', '</u>')"><span class="material-symbols-outlined notranslate" translate="no">format_underlined</span></button>
      <button type="button" class="icon-btn" title="Strikethrough" aria-label="Strikethrough" @click="wrapSelection('~~', '~~')"><span class="material-symbols-outlined notranslate" translate="no">strikethrough_s</span></button>
      <button type="button" class="icon-btn" title="Highlight" aria-label="Highlight" @click="wrapSelection('==', '==')"><span class="material-symbols-outlined notranslate" translate="no">ink_highlighter</span></button>
      <button type="button" class="icon-btn" title="Superscript" aria-label="Superscript" @click="wrapSelection('^', '^')"><span class="material-symbols-outlined notranslate" translate="no">superscript</span></button>
      <button type="button" class="icon-btn" title="Subscript" aria-label="Subscript" @click="wrapSelection('~', '~')"><span class="material-symbols-outlined notranslate" translate="no">subscript</span></button>
      <button type="button" class="icon-btn" title="Inline code" aria-label="Inline code" @click="wrapSelection('`', '`')"><span class="material-symbols-outlined notranslate" translate="no">code</span></button>
      <span class="sep" />
      <div ref="headingMenuRef" class="heading-menu">
        <button type="button" class="icon-btn" title="Heading levels" aria-label="Heading levels" @click.stop="toggleHeadingMenu">
          <span class="material-symbols-outlined notranslate" translate="no">title</span>
        </button>
        <div v-if="headingMenuOpen" class="heading-menu-list">
          <button type="button" class="heading-menu-item" @click="applyHeading(1)">H1</button>
          <button type="button" class="heading-menu-item" @click="applyHeading(2)">H2</button>
          <button type="button" class="heading-menu-item" @click="applyHeading(3)">H3</button>
          <button type="button" class="heading-menu-item" @click="applyHeading(4)">H4</button>
          <button type="button" class="heading-menu-item" @click="applyHeading(5)">H5</button>
        </div>
      </div>
      <button type="button" class="icon-btn" title="Bulleted list" aria-label="Bulleted list" @click="insertLinePrefix('- ', 'list item')"><span class="material-symbols-outlined notranslate" translate="no">format_list_bulleted</span></button>
      <button type="button" class="icon-btn" title="Numbered list" aria-label="Numbered list" @click="insertLinePrefix('1. ', 'list item')"><span class="material-symbols-outlined notranslate" translate="no">format_list_numbered</span></button>
      <button type="button" class="icon-btn" title="Task list" aria-label="Task list" @click="insertLinePrefix('- [ ] ', 'task')"><span class="material-symbols-outlined notranslate" translate="no">checklist</span></button>
      <button type="button" class="icon-btn" title="Quote" aria-label="Quote" @click="insertLinePrefix('> ', 'quote')"><span class="material-symbols-outlined notranslate" translate="no">format_quote</span></button>
      <button type="button" class="icon-btn" title="Code block" aria-label="Code block" @click="insertText('\n```\ncode\n```\n')"><span class="material-symbols-outlined notranslate" translate="no">data_object</span></button>
      <span class="sep" />
      <button type="button" class="icon-btn" title="Link" aria-label="Link" @click="wrapSelection('[', '](https://example.com)', 'link text')"><span class="material-symbols-outlined notranslate" translate="no">link</span></button>
      <button type="button" class="icon-btn" title="Insert image" aria-label="Insert image" @click="triggerUpload"><span class="material-symbols-outlined notranslate" translate="no">image</span></button>
      <div ref="tableMenuRef" class="table-menu">
        <button type="button" class="icon-btn" title="Insert table" aria-label="Insert table" @click.stop="toggleTableMenu">
          <span class="material-symbols-outlined notranslate" translate="no">grid_on</span>
        </button>
        <div v-if="tableMenuOpen" class="table-menu-list">
          <div
            class="table-grid"
            :style="{ gridTemplateColumns: `repeat(${TABLE_GRID_MAX}, 16px)` }"
            @mouseleave="setTableHover(1, 1)"
          >
            <button
              v-for="idx in TABLE_GRID_MAX * TABLE_GRID_MAX"
              :key="idx"
              type="button"
              class="table-grid-cell"
              :class="{ active: ((idx - 1) % TABLE_GRID_MAX) + 1 <= tableHoverCols && Math.floor((idx - 1) / TABLE_GRID_MAX) + 1 <= tableHoverRows }"
              @mouseenter="setTableHover(((idx - 1) % TABLE_GRID_MAX) + 1, Math.floor((idx - 1) / TABLE_GRID_MAX) + 1)"
              @click="applyTableSize(((idx - 1) % TABLE_GRID_MAX) + 1, Math.floor((idx - 1) / TABLE_GRID_MAX) + 1)"
            />
          </div>
          <div class="table-grid-label">{{ tableHoverCols }} × {{ tableHoverRows }}</div>
        </div>
      </div>
      <button
        type="button"
        class="icon-btn"
        title="Выровнять markdown-таблицу под курсором"
        aria-label="Выровнять markdown-таблицу под курсором"
        @click="formatMarkdownTableAtCursor"
      >
        <span class="material-symbols-outlined notranslate" translate="no">format_align_justify</span>
      </button>
      <button type="button" class="icon-btn" title="Wiki link" aria-label="Wiki link" @click="wrapSelection('[[', ']]', 'Page Title')"><span class="material-symbols-outlined notranslate" translate="no">article_shortcut</span></button>
      <button type="button" class="icon-btn" title="Tag" aria-label="Tag" @click="insertText(' #tag')"><span class="material-symbols-outlined notranslate" translate="no">sell</span></button>
      <div ref="emojiMenuRef" class="emoji-menu">
        <button type="button" class="icon-btn" title="Insert emoji" aria-label="Insert emoji" @click.stop="toggleEmojiMenu">
          <span class="material-symbols-outlined notranslate" translate="no">sentiment_satisfied</span>
        </button>
        <div v-if="emojiMenuOpen" class="emoji-menu-list">
          <button
            v-for="emoji in emojiItems"
            :key="emoji"
            type="button"
            class="emoji-item"
            :title="emoji"
            @click="applyEmoji(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
      <span class="sep" />
      <button type="button" class="icon-btn" title="Undo" aria-label="Undo" :disabled="!canUndo" @click="undo"><span class="material-symbols-outlined notranslate" translate="no">undo</span></button>
      <button type="button" class="icon-btn" title="Redo" aria-label="Redo" :disabled="!canRedo" @click="redo"><span class="material-symbols-outlined notranslate" translate="no">redo</span></button>
      <button type="button" class="icon-btn" title="Save" aria-label="Save" @click="emit('save')"><span class="material-symbols-outlined notranslate" translate="no">save</span></button>
      <span class="mode-switch">
        <button type="button" class="icon-btn" title="Editor" aria-label="Editor" :class="{ active: editorMode === 'editor' }" @click="setMode('editor')"><span class="material-symbols-outlined notranslate" translate="no">edit_note</span></button>
        <button type="button" class="icon-btn" title="Split" aria-label="Split" :class="{ active: editorMode === 'split' }" @click="setMode('split')"><span class="material-symbols-outlined notranslate" translate="no">split_scene</span></button>
        <button type="button" class="icon-btn" title="Preview" aria-label="Preview" :class="{ active: editorMode === 'preview' }" @click="setMode('preview')"><span class="material-symbols-outlined notranslate" translate="no">preview</span></button>
        <button type="button" class="icon-btn" title="Reading" aria-label="Reading" :class="{ active: editorMode === 'reading' }" @click="setMode('reading')"><span class="material-symbols-outlined notranslate" translate="no">menu_book</span></button>
      </span>
      </template>
    </div>
    <div ref="splitShellRef" class="editor-shell" :class="`mode-${editorMode}`" :style="editorShellStyle">
      <div v-if="editorMode === 'editor' || editorMode === 'split'" class="editor-pane">
        <textarea
          ref="editorRef"
          class="markdown-input"
          :value="markdownValue"
          spellcheck="false"
          @input="onEditorInput"
          @keydown="onEditorKeydown"
          @click="refreshWikilinkSuggestions"
          @keyup="refreshWikilinkSuggestions"
          @scroll="onEditorScroll"
          @blur="wikilink.close()"
        />
        <div v-if="wikilinkOpen" class="wikilink-suggestions" :style="wikilinkMenuStyle">
          <button
            v-for="(item, idx) in wikilinkItems"
            :key="item.slug"
            type="button"
            class="wikilink-suggestion-item"
            :class="{ active: idx === wikilinkSelected }"
            @mousedown.prevent="applyWikilinkSuggestion(idx)"
          >
            <span>{{ item.title }}</span>
            <small>{{ item.slug }}</small>
          </button>
        </div>
      </div>
      <div
        v-if="editorMode === 'split'"
        class="split-resizer"
        :class="{ dragging: splitDragging }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize split panes"
        @mousedown="startSplitDrag"
        @dblclick="resetSplitRatio"
      />
      <div
        v-if="editorMode !== 'editor'"
        ref="previewPaneRef"
        class="preview-pane"
        @click="onPreviewClick"
        @scroll="onPreviewScroll"
      >
        <div class="preview-content markdown-body" v-html="previewHtml" />
      </div>
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.reading-logo {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
}

.reading-logo:hover {
  color: var(--color-primary);
}

.reading-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.icon-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: 6px;
  padding: 0;
}

.icon-btn .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}

.icon-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sep {
  width: 1px;
  height: 22px;
  background: var(--color-border);
  margin: 0 2px;
}

.mode-switch {
  margin-left: auto;
  display: inline-flex;
  gap: 4px;
}

.heading-menu,
.table-menu,
.emoji-menu {
  position: relative;
}

.heading-menu-list,
.table-menu-list,
.emoji-menu-list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  z-index: 30;
}

.heading-menu-list {
  display: grid;
  gap: 2px;
  padding: 6px;
  min-width: 64px;
}

.heading-menu-item {
  border: none;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  padding: 6px 8px;
  border-radius: 6px;
}

.heading-menu-item:hover {
  background: var(--color-bg-hover);
}

.table-menu-list {
  padding: 8px;
  width: max-content;
}

.table-grid {
  display: grid;
  gap: 3px;
}

.toolbar .table-grid-cell {
  width: 16px;
  min-width: 16px;
  height: 16px;
  min-height: 16px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  border-radius: 2px;
  padding: 0;
}

.toolbar .table-grid-cell.active {
  background: color-mix(in srgb, var(--color-primary) 26%, var(--color-bg-secondary));
  border-color: color-mix(in srgb, var(--color-primary) 54%, var(--color-border));
}

.table-grid-label {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.emoji-menu-list {
  width: 284px;
  max-height: 210px;
  overflow: auto;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 4px;
}

.emoji-item {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 6px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 18px;
}

.emoji-item:hover {
  border-color: var(--color-border);
  background: var(--color-bg-hover);
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

.editor-pane,
.preview-pane {
  min-height: 0;
  height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
}

.editor-pane {
  overflow: hidden;
  position: relative;
}

.preview-pane {
  overflow: auto;
  padding: 14px;
}

.preview-content {
  width: 100%;
}

.editor-shell.mode-reading .preview-pane {
  border: none;
  border-radius: 0;
  padding: 28px clamp(56px, 10vw, 220px);
  background: var(--color-bg);
  position: relative;
}

.editor-shell.mode-reading .preview-content {
  max-width: 920px;
  margin: 0 auto;
}

.reading-exit-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  color: var(--color-text);
  border-radius: 50%;
  padding: 0;
}

.reading-exit-btn .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.markdown-input {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  padding: 14px;
  overflow: auto;
}

.split-resizer {
  width: 8px;
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.split-resizer::before {
  content: '';
  width: 4px;
  height: 56px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 85%, transparent);
  transition: background 0.12s ease, transform 0.12s ease;
}

.split-resizer:hover::before,
.split-resizer.dragging::before {
  background: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  transform: scaleX(1.15);
}

.wikilink-suggestions {
  position: fixed;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  z-index: 40;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
}

.wikilink-suggestion-item {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
}

.wikilink-suggestion-item small {
  color: var(--color-text-muted);
}

.wikilink-suggestion-item.active,
.wikilink-suggestion-item:hover {
  background: var(--color-bg-hover);
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

:deep(.markdown-body code) {
  font-family: var(--font-mono);
}

:deep(.markdown-body pre) {
  overflow: auto;
  border-radius: 8px;
}

:deep(.markdown-body pre code.hljs) {
  display: block;
  padding: 12px;
}

:deep(.markdown-body .task-list-item) {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

:deep(.markdown-body .task-list-item input[type='checkbox']) {
  width: 16px;
  min-width: 16px;
  height: 16px;
  margin: 0.22rem 0 0;
}

:deep(.markdown-body .wikilink) {
  color: var(--color-wikilink);
  text-decoration: underline;
  text-decoration-style: dotted;
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

::deep(.markdown-body .mermaid) {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

::deep(.markdown-body .mermaid svg) {
  max-width: 100%;
  height: auto;
}

[data-theme='dark'] :deep(.markdown-body pre code.hljs) {
  background: #272822;
  color: #f8f8f2;
}
</style>
