import { computed, nextTick, type Ref } from 'vue'
import { t } from '@/utils/i18n'
import { formatPipeTableAtCursor } from '@/utils/formatMarkdownTable'
import type { ToolbarAction } from './toolbarTypes'
import type { EditorMode } from './editorPreferences'

const EMOJI_ITEMS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '🙂', '😉', '😍', '😘', '😗', '😚', '😋', '😎',
  '🤩', '🤔', '🫠', '😐', '😑', '🙄', '😴', '🤯',
  '🥳', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥',
  '✨', '💡', '🎯', '✅', '❌', '⚠️', '🚀', '📌',
  '📎', '📷', '🧠', '🔧', '📝', '💬', '🌟', '💯'
]

export interface ToolbarActionsOptions {
  getEditor: () => HTMLTextAreaElement | null
  getValue: () => string
  applyValue: (value: string) => void
  closeWikilink: () => void
  refreshWikilinkSuggestions: () => void
  triggerUpload: () => void
  openEditorFind: () => void
  undo: () => void
  redo: () => void
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  onSave: () => void
  setMode: (mode: EditorMode) => void
  editorMode: Ref<EditorMode>
}

/** Текстовые преобразования в textarea и наборы экшенов для EditorToolbar. */
export function useToolbarActions(options: ToolbarActionsOptions) {
  function applySelection(transform: (selected: string) => { text: string; cursorOffset?: number }) {
    const el = options.getEditor()
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = options.getValue().slice(start, end)
    const { text, cursorOffset } = transform(selected)
    const nextValue = options.getValue().slice(0, start) + text + options.getValue().slice(end)
    options.applyValue(nextValue)

    nextTick(() => {
      const nextPos = start + (cursorOffset ?? text.length)
      el.focus()
      el.setSelectionRange(nextPos, nextPos)
      options.refreshWikilinkSuggestions()
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
    options.closeWikilink()
    const el = options.getEditor()
    if (!el) return
    const cursor = Math.min(el.selectionStart, el.selectionEnd)
    const result = formatPipeTableAtCursor(options.getValue(), cursor)
    if (!result) return
    options.applyValue(result.text)
    nextTick(() => {
      el.focus()
      el.setSelectionRange(result.cursor, result.cursor)
      options.refreshWikilinkSuggestions()
    })
  }

  function continueListOnEnter(): boolean {
    const el = options.getEditor()
    if (!el) return false
    if (el.selectionStart !== el.selectionEnd) return false

    const pos = el.selectionStart
    const src = options.getValue()
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
        options.applyValue(next)
        nextTick(() => {
          const p = lineStart
          el.setSelectionRange(p, p)
        })
        return true
      }
      const insert = `\n${indent}${bullet} [${state === ' ' ? ' ' : ' '}] `
      options.applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
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
        options.applyValue(next)
        nextTick(() => {
          const p = lineStart
          el.setSelectionRange(p, p)
        })
        return true
      }
      const insert = `\n${indent}${Number(numRaw) + 1}. `
      options.applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
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
        options.applyValue(next)
        nextTick(() => {
          const p = lineStart
          el.setSelectionRange(p, p)
        })
        return true
      }
      const insert = `\n${indent}${marker} `
      options.applyValue(`${src.slice(0, pos)}${insert}${src.slice(pos)}`)
      nextTick(() => {
        const p = pos + insert.length
        el.setSelectionRange(p, p)
      })
      return true
    }

    return false
  }

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
    { key: 'upload-image', title: 'Insert image', ariaLabel: 'Insert image', icon: 'image', onClick: options.triggerUpload },
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
    { key: 'find', title: t.editor.findTitle, ariaLabel: t.editor.findTitle, icon: 'search', onClick: () => options.openEditorFind() },
    { key: 'undo', title: 'Undo', ariaLabel: 'Undo', icon: 'undo', onClick: options.undo, disabled: !options.canUndo.value },
    { key: 'redo', title: 'Redo', ariaLabel: 'Redo', icon: 'redo', onClick: options.redo, disabled: !options.canRedo.value },
    { key: 'save', title: 'Save', ariaLabel: 'Save', icon: 'save', onClick: options.onSave }
  ])

  const modeSwitchActions = computed<ToolbarAction[]>(() => [
    { key: 'mode-editor', title: 'Editor', ariaLabel: 'Editor', icon: 'edit_note', active: options.editorMode.value === 'editor', onClick: () => options.setMode('editor') },
    { key: 'mode-split', title: 'Split', ariaLabel: 'Split', icon: 'split_scene', active: options.editorMode.value === 'split', onClick: () => options.setMode('split') },
    { key: 'mode-preview', title: 'Preview', ariaLabel: 'Preview', icon: 'preview', active: options.editorMode.value === 'preview', onClick: () => options.setMode('preview') },
    { key: 'mode-reading', title: 'Reading', ariaLabel: 'Reading', icon: 'menu_book', onClick: () => options.setMode('reading') }
  ])

  return {
    emojiItems: EMOJI_ITEMS,
    inlineFormatActions,
    listAndBlockActions,
    quickInsertActions,
    historyActions,
    modeSwitchActions,
    applyHeading,
    applyTableSize,
    applyEmoji,
    insertText,
    continueListOnEnter
  }
}
