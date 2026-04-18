<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Suggestion from '@tiptap/suggestion'
import MarkdownIt from 'markdown-it'
import markdownItMark from 'markdown-it-mark'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { useThemeStore } from '@/stores/theme'
import { uploadAttachment } from '@/api/attachments'
import { listPages } from '@/api/pages'
import { stripMarkdownFrontmatter } from '@/utils/frontmatter'
import { normalizePageSlug } from '@/utils/pageSlug'
import { readWikilinkPagesCache, writeWikilinkPagesCache } from '@/utils/wikilinkPageListCache'
import { wikilinkPreviewHref } from '@/utils/wikilinkResolve'
import type { PageListItem } from '@/types'

const WIKI_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g
const FRONTMATTER_FENCE =
  /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m
const TAG_REGEX = /(?:^|\s)#([\w\u0400-\u04FF-]+)/g

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const src = markdown ?? ''
  const match = FRONTMATTER_FENCE.exec(src)
  if (!match) return { frontmatter: '', body: src }
  const body = src.slice(match.index + match[0].length).replace(/^[\r\n]+/, '')
  return { frontmatter: match[0].trimEnd(), body }
}

function joinFrontmatter(frontmatter: string, body: string): string {
  const cleanBody = body.trim()
  if (!frontmatter) return cleanBody
  if (!cleanBody) return `${frontmatter}\n`
  return `${frontmatter}\n\n${cleanBody}`
}

function toWikilinkInner(page: PageListItem): string {
  const slug = page.slug.trim()
  const normalizedTitle = normalizePageSlug(page.title)
  if (normalizedTitle === slug) {
    return page.title.replace(/\]/g, '')
  }
  return `${slug}|${page.title.replace(/\]/g, '').replace(/\|/g, ' ')}`
}

async function getCachedPages(): Promise<PageListItem[]> {
  const now = Date.now()
  const cache = readWikilinkPagesCache(now)
  if (cache) return cache
  const { data } = await listPages()
  writeWikilinkPagesCache(data, now)
  return data
}

function matchesQuery(page: PageListItem, query: string): boolean {
  const q = query.toLowerCase()
  return (
    page.title.toLowerCase().includes(q) ||
    page.slug.toLowerCase().includes(q) ||
    normalizePageSlug(page.title).includes(q)
  )
}

const WikilinkMark = Mark.create({
  name: 'wikilink',
  inclusive: false,
  addAttributes() {
    return {
      slug: { default: '' },
      label: { default: '' },
      href: { default: '' }
    }
  },
  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const slug = String(HTMLAttributes.slug || '').trim()
    const label = String(HTMLAttributes.label || '').trim()
    const href = String(HTMLAttributes.href || wikilinkPreviewHref(slug || label))
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wikilink': '1',
        href,
        class: 'wikilink'
      }),
      0
    ]
  }
})

type WikilinkSuggestionItem = {
  title: string
  slug: string
  inner: string
}

const WikilinkSuggestion = Extension.create({
  name: 'wikilinkSuggestion',
  addProseMirrorPlugins() {
    const key = new PluginKey('wikilinkSuggestion')
    return [
      Suggestion<WikilinkSuggestionItem>({
        editor: this.editor,
        pluginKey: key,
        allow: ({ state, range }) => {
          if (range.from < 2) return false
          const before = state.doc.textBetween(range.from - 2, range.from, '\0', '\0')
          return before === '[['
        },
        char: '[',
        items: async ({ query }) => {
          const pages = await getCachedPages()
          const filtered = query.trim()
            ? pages.filter((p) => matchesQuery(p, query.trim()))
            : pages
          return filtered
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }))
            .slice(0, 8)
            .map((p) => ({ title: p.title, slug: p.slug, inner: toWikilinkInner(p) }))
        },
        command: ({ editor, range, props }) => {
          const from = Math.max(0, range.from - 1)
          const to = range.to
          const label = props.title
          const slug = props.slug
          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent({
              type: 'text',
              text: label,
              marks: [
                {
                  type: 'wikilink',
                  attrs: {
                    slug,
                    label,
                    href: wikilinkPreviewHref(slug)
                  }
                }
              ]
            })
            .run()
        },
        render: () => {
          let root: HTMLDivElement | null = null
          let activeIndex = 0
          let lastProps: {
            items: WikilinkSuggestionItem[]
            command: (item: WikilinkSuggestionItem) => void
            clientRect?: (() => DOMRect | null) | null
          } | null = null

          const place = () => {
            if (!root || !lastProps?.clientRect) return
            const rect = lastProps.clientRect()
            if (!rect) return
            root.style.left = `${rect.left + window.scrollX}px`
            root.style.top = `${rect.bottom + window.scrollY + 8}px`
          }

          const repaint = () => {
            if (!root || !lastProps) return
            root.innerHTML = ''
            if (lastProps.items.length === 0) {
              const empty = document.createElement('div')
              empty.className = 'wikilink-suggestion-empty'
              empty.textContent = 'No pages found'
              root.appendChild(empty)
              return
            }
            lastProps.items.forEach((item, idx) => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.className = 'wikilink-suggestion-item'
              if (idx === activeIndex) btn.classList.add('is-active')
              btn.innerHTML = `<span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.slug)}</small>`
              btn.onmousedown = (event) => {
                event.preventDefault()
                lastProps?.command(item)
              }
              root?.appendChild(btn)
            })
          }

          return {
            onStart: (props) => {
              activeIndex = 0
              lastProps = props
              root = document.createElement('div')
              root.className = 'wikilink-suggestion'
              document.body.appendChild(root)
              place()
              repaint()
            },
            onUpdate: (props) => {
              activeIndex = 0
              lastProps = props
              place()
              repaint()
            },
            onKeyDown: (props) => {
              if (!lastProps) return false
              if (props.event.key === 'Escape') return true
              if (props.event.key === 'ArrowDown') {
                props.event.preventDefault()
                activeIndex = Math.min(activeIndex + 1, Math.max(0, lastProps.items.length - 1))
                repaint()
                return true
              }
              if (props.event.key === 'ArrowUp') {
                props.event.preventDefault()
                activeIndex = Math.max(activeIndex - 1, 0)
                repaint()
                return true
              }
              if (props.event.key === 'Enter') {
                props.event.preventDefault()
                const item = lastProps.items[activeIndex]
                if (item) {
                  lastProps.command(item)
                  return true
                }
              }
              return false
            },
            onExit: () => {
              root?.remove()
              root = null
              lastProps = null
            }
          }
        }
      })
    ]
  }
})

const HashtagHighlight = Extension.create({
  name: 'hashtagHighlight',
  addProseMirrorPlugins() {
    const key = new PluginKey('hashtagHighlight')
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => {
            const decorations: Decoration[] = []
            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              const text = node.text
              TAG_REGEX.lastIndex = 0
              let match: RegExpExecArray | null = TAG_REGEX.exec(text)
              while (match) {
                const offset = match[0].startsWith(' ') ? 1 : 0
                const from = pos + match.index + offset
                const to = from + `#${match[1]}`.length
                decorations.push(Decoration.inline(from, to, { class: 'hashtag' }))
                match = TAG_REGEX.exec(text)
              }
            })
            return DecorationSet.create(doc, decorations)
          },
          apply: (tr, oldState, _oldEditorState, newEditorState) => {
            if (!tr.docChanged) return oldState
            const decorations: Decoration[] = []
            newEditorState.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              const text = node.text
              TAG_REGEX.lastIndex = 0
              let match: RegExpExecArray | null = TAG_REGEX.exec(text)
              while (match) {
                const offset = match[0].startsWith(' ') ? 1 : 0
                const from = pos + match.index + offset
                const to = from + `#${match[1]}`.length
                decorations.push(Decoration.inline(from, to, { class: 'hashtag' }))
                match = TAG_REGEX.exec(text)
              }
            })
            return DecorationSet.create(newEditorState.doc, decorations)
          }
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
}).use(markdownItMark)

const turndown = new TurndownService({
  bulletListMarker: '-',
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})
turndown.use(gfm)

turndown.addRule('wikilink', {
  filter: (node) => node.nodeName === 'A' && node instanceof HTMLElement && node.dataset.wikilink === '1',
  replacement: (content, node) => {
    if (!(node instanceof HTMLElement)) return content
    const slug = (node.dataset.slug || '').trim()
    const label = (node.dataset.label || content || '').trim()
    if (!slug) return label
    if (!label || label === slug) return `[[${slug}]]`
    return `[[${slug}|${label.replace(/\]/g, '').replace(/\|/g, ' ')}]]`
  }
})

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const themeStore = useThemeStore()
const uploadError = ref('')
const uploadInput = ref<HTMLInputElement | null>(null)
const editorMode = ref<'editor' | 'split' | 'preview'>('editor')
const frontmatterRef = ref('')
const bodyMarkdownRef = ref('')
const syncingFromProps = ref(false)
const lastEmittedValue = ref(props.modelValue)

function wikilinkTextToHtml(markdownBody: string): string {
  return markdownBody.replace(WIKI_REGEX, (_match, slugRaw: string, labelRaw?: string) => {
    const slug = slugRaw.trim()
    const label = (labelRaw?.trim() || slug).trim()
    const href = wikilinkPreviewHref(slug)
    return `<a data-wikilink="1" data-slug="${escapeHtml(slug)}" data-label="${escapeHtml(label)}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
  })
}

function markdownToHtml(markdownBody: string): string {
  const noFrontmatter = stripMarkdownFrontmatter(markdownBody)
  return md.render(wikilinkTextToHtml(noFrontmatter))
}

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}

function syncFromModel(markdown: string) {
  const { frontmatter, body } = splitFrontmatter(markdown)
  frontmatterRef.value = frontmatter
  bodyMarkdownRef.value = body
  const instance = editor.value
  if (!instance) return
  syncingFromProps.value = true
  instance.commands.setContent(markdownToHtml(body), { emitUpdate: false })
  nextTick(() => {
    syncingFromProps.value = false
  })
}

const editor = useEditor({
  content: '',
  editable: true,
  extensions: [
    StarterKit.configure({
      link: false
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto']
    }),
    Image.configure({
      allowBase64: false
    }),
    Underline,
    Highlight,
    TaskList,
    TaskItem.configure({
      nested: true
    }),
    Subscript,
    Superscript,
    Placeholder.configure({
      placeholder: 'Write your page...'
    }),
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableHeader,
    TableCell,
    WikilinkMark,
    WikilinkSuggestion,
    HashtagHighlight,
    Extension.create({
      name: 'saveShortcut',
      addKeyboardShortcuts() {
        return {
          'Mod-s': () => {
            emit('save')
            return true
          }
        }
      }
    })
  ],
  onUpdate: ({ editor: tiptap }) => {
    if (syncingFromProps.value) return
    bodyMarkdownRef.value = htmlToMarkdown(tiptap.getHTML())
    const joined = joinFrontmatter(frontmatterRef.value, bodyMarkdownRef.value)
    lastEmittedValue.value = joined
    emit('update:modelValue', joined)
  }
})

const previewHtml = computed(() => markdownToHtml(bodyMarkdownRef.value))

watch(
  () => props.modelValue,
  (value) => {
    if (value === lastEmittedValue.value) return
    syncFromModel(value)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function setMode(mode: 'editor' | 'split' | 'preview') {
  editorMode.value = mode
}

function isActive(name: string, attrs?: Record<string, unknown>) {
  return editor.value?.isActive(name, attrs) ?? false
}

function run(command: (instance: NonNullable<typeof editor.value>) => boolean) {
  const instance = editor.value
  if (!instance) return
  command(instance)
}

function toggleLink() {
  const instance = editor.value
  if (!instance) return
  const previous = instance.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', previous ?? 'https://')
  if (url === null) return
  if (!url.trim()) {
    instance.chain().focus().unsetLink().run()
    return
  }
  instance.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
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
    const instance = editor.value
    if (!instance) return
    urls.forEach((url) => {
      instance.chain().focus().setImage({ src: url }).run()
    })
  } catch (error) {
    if (axios.isAxiosError(error)) {
      uploadError.value = error.response?.data?.message || 'Image upload failed'
    } else {
      uploadError.value = 'Image upload failed'
    }
  } finally {
    if (uploadInput.value) uploadInput.value.value = ''
  }
}

function triggerUpload() {
  uploadInput.value?.click()
}
</script>

<template>
  <div class="markdown-editor-wrapper" :class="{ dark: themeStore.isDark }">
    <div class="toolbar">
      <button type="button" :class="{ active: isActive('bold') }" @click="run((e) => e.chain().focus().toggleBold().run())">B</button>
      <button type="button" :class="{ active: isActive('italic') }" @click="run((e) => e.chain().focus().toggleItalic().run())">I</button>
      <button type="button" :class="{ active: isActive('underline') }" @click="run((e) => e.chain().focus().toggleUnderline().run())">U</button>
      <button type="button" :class="{ active: isActive('strike') }" @click="run((e) => e.chain().focus().toggleStrike().run())">S</button>
      <button type="button" :class="{ active: isActive('highlight') }" @click="run((e) => e.chain().focus().toggleHighlight().run())">Mark</button>
      <span class="sep" />
      <button type="button" :class="{ active: isActive('bulletList') }" @click="run((e) => e.chain().focus().toggleBulletList().run())">UL</button>
      <button type="button" :class="{ active: isActive('orderedList') }" @click="run((e) => e.chain().focus().toggleOrderedList().run())">OL</button>
      <button type="button" :class="{ active: isActive('taskList') }" @click="run((e) => e.chain().focus().toggleTaskList().run())">Task</button>
      <button type="button" :class="{ active: isActive('codeBlock') }" @click="run((e) => e.chain().focus().toggleCodeBlock().run())">Code</button>
      <button type="button" :class="{ active: isActive('blockquote') }" @click="run((e) => e.chain().focus().toggleBlockquote().run())">Quote</button>
      <span class="sep" />
      <button type="button" :class="{ active: isActive('subscript') }" @click="run((e) => e.chain().focus().toggleSubscript().run())">Sub</button>
      <button type="button" :class="{ active: isActive('superscript') }" @click="run((e) => e.chain().focus().toggleSuperscript().run())">Sup</button>
      <button type="button" :class="{ active: isActive('link') }" @click="toggleLink">Link</button>
      <button type="button" @click="triggerUpload">Image</button>
      <button type="button" @click="run((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())">Table</button>
      <span class="sep" />
      <button type="button" @click="run((e) => e.chain().focus().undo().run())">Undo</button>
      <button type="button" @click="run((e) => e.chain().focus().redo().run())">Redo</button>
      <button type="button" @click="emit('save')">Save</button>
      <span class="mode-switch">
        <button type="button" :class="{ active: editorMode === 'editor' }" @click="setMode('editor')">Editor</button>
        <button type="button" :class="{ active: editorMode === 'split' }" @click="setMode('split')">Split</button>
        <button type="button" :class="{ active: editorMode === 'preview' }" @click="setMode('preview')">Preview</button>
      </span>
    </div>

    <div class="editor-shell" :class="`mode-${editorMode}`">
      <div v-if="editorMode !== 'preview'" class="editor-pane">
        <EditorContent :editor="editor" class="tiptap-content" />
      </div>
      <div v-if="editorMode !== 'editor'" class="preview-pane markdown-body" v-html="previewHtml" />
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

.toolbar button {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: 6px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
}

.toolbar button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
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

.editor-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 8px;
}

.editor-shell.mode-editor {
  grid-template-columns: 1fr;
}

.editor-shell.mode-split {
  grid-template-columns: 1fr 1fr;
}

.editor-shell.mode-preview {
  grid-template-columns: 1fr;
}

.editor-pane,
.preview-pane {
  min-height: 0;
  height: 100%;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
}

.preview-pane {
  padding: 14px;
}

.tiptap-content :deep(.ProseMirror) {
  min-height: 100%;
  padding: 14px;
  outline: none;
  color: var(--color-text);
}

.tiptap-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: var(--color-text-faint);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.tiptap-content :deep(.ProseMirror a.wikilink) {
  color: var(--color-wikilink);
  text-decoration: underline;
  text-decoration-style: dotted;
}

.tiptap-content :deep(.ProseMirror .hashtag) {
  color: var(--color-tag);
  font-weight: 500;
}

.tiptap-content :deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
}

.tiptap-content :deep(.ProseMirror table td),
.tiptap-content :deep(.ProseMirror table th) {
  border: 1px solid var(--color-border);
  padding: 6px;
}

.tiptap-content :deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: 4px;
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

:global(.wikilink-suggestion) {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  width: 280px;
  max-height: 260px;
  overflow: auto;
  z-index: 30000;
  position: absolute;
  padding: 4px;
}

:global(.wikilink-suggestion-item) {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

:global(.wikilink-suggestion-item small) {
  color: var(--color-text-muted);
}

:global(.wikilink-suggestion-item.is-active),
:global(.wikilink-suggestion-item:hover) {
  background: var(--color-bg-hover);
}

:global(.wikilink-suggestion-empty) {
  padding: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
