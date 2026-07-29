<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDialogStore } from '@/stores/dialog'
import { useThemeStore } from '@/stores/theme'
import { uploadAttachment } from '@/api/attachments'
import { getApiErrorMessage } from '@/utils/apiError'
import { downloadPagePdf } from '@/utils/exportPagePdf'
import { useI18n } from 'vue-i18n'
import { readString, writeString } from '@/utils/localPreferences'
import { useEditorHistory } from '@/composables/useEditorHistory'
import { useWikilinkAutocomplete } from '@/composables/useWikilinkAutocomplete'
import { useEditorFind } from '@/composables/useEditorFind'
import { getPages } from '@/services/pageIndex'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useHorizontalDragResize } from '@/composables/useHorizontalDragResize'
import { normalizePageSlug } from '@/utils/pageSlug'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import VerticalPaneResizer from '@/components/ui/VerticalPaneResizer.vue'
import ReadingToolbar from '@/components/editor/ReadingToolbar.vue'
import EditorToolbar from '@/components/editor/EditorToolbar.vue'
import EditorPreviewPane from '@/components/editor/EditorPreviewPane.vue'
import EditorInputPane from '@/components/editor/EditorInputPane.vue'
import AnnotationPanel from '@/components/annotations/AnnotationPanel.vue'
import AnnotationPopup from '@/components/annotations/AnnotationPopup.vue'
import type { ReadingTheme } from '@/types'
import { usePreviewCopyDecorations } from '@/components/editor/usePreviewCopyDecorations'
import { usePreviewRenderPipeline } from '@/components/editor/usePreviewRenderPipeline'
import { useReadingToc } from '@/components/editor/useReadingToc'
import { useSplitScrollSync } from '@/components/editor/useSplitScrollSync'
import { useAnnotations } from '@/components/editor/useAnnotations'
import { useToolbarActions } from '@/components/editor/useToolbarActions'
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

let markdownRenderer: MarkdownIt | null = null
let markdownRendererPromise: Promise<MarkdownIt> | null = null

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

const { t } = useI18n()
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

const {
  annotations,
  annotationsVisible,
  annotationPopup,
  floatingBtn,
  tooltipAnnotation,
  fetchAnnotations,
  applyAnnotationHighlights,
  onReadingMouseUp,
  onReadingMouseDown,
  onReadingTouchEnd,
  startAnnotation,
  onAnnotationCreated,
  onAnnotationDeleted,
  handleModeChange: handleAnnotationModeChange,
  dispose: disposeAnnotations
} = useAnnotations({
  getPreviewContentElement,
  getEditorMode: () => editorMode.value
})

const {
  emojiItems,
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
} = useToolbarActions({
  getEditor: getEditorElement,
  getValue: () => markdownValue.value,
  applyValue: (value) => applyValue(value),
  closeWikilink: () => wikilink.close(),
  refreshWikilinkSuggestions,
  triggerUpload,
  openEditorFind,
  undo,
  redo,
  canUndo,
  canRedo,
  onSave: () => emit('save'),
  setMode,
  editorMode
})

// Токен последнего рендера превью — в инстансе компонента, а не в модульном синглтоне.
let previewRenderToken = 0

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
  handleAnnotationModeChange(value)
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
    uploadError.value = getApiErrorMessage(error, t('errors.imageUploadFailed'))
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
      await dialog.alert(t('export.pdfNoPreview'))
      return
    }

    await downloadPagePdf({
      title: props.readingTitle || 'Untitled',
      contentElement: content
    })
  } catch (error) {
    await dialog.alert(getApiErrorMessage(error, t('export.pdfFailed')))
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
  previewHtml.value = sanitizeHtml(renderer.render(markdownValue.value))
  await nextTick()
  if (token !== previewRenderToken) return
  await renderPreviewDiagrams()
}

async function onPreviewClick(event: MouseEvent) {
  tooltipAnnotation.value = null
  await previewCopyDecorations.onPreviewClick(event)
}

onMounted(() => {
  emit('mode-change', editorMode.value)
  void getPages()
  void refreshPreview()
  if (editorMode.value === 'reading') {
    void fetchAnnotations().then(() => {
      void nextTick().then(() => applyAnnotationHighlights())
    })
  }
})

onBeforeUnmount(() => {
  cancelWikilinkBlur()
  clearDragListeners()
  disposeAnnotations()
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
        :ariaLabel="t('editor.splitResize')"
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
    <div
      v-if="tooltipAnnotation"
      class="annotation-tooltip"
      :style="{ left: tooltipAnnotation.x + 'px', top: tooltipAnnotation.y + 'px' }"
      @click.stop="tooltipAnnotation = null"
    >
      <div class="tooltip-text">
        <q>{{ tooltipAnnotation.annotation.highlightedText }}</q>
      </div>
      <div v-if="tooltipAnnotation.annotation.comment" class="tooltip-comment">
        {{ tooltipAnnotation.annotation.comment }}
      </div>
      <div class="tooltip-meta">
        <span>{{ tooltipAnnotation.annotation.createdBy }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./readingThemes.css" />

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

.annotation-tooltip {
  position: fixed;
  z-index: 600;
  transform: translate(-50%, -100%);
  max-width: 320px;
  padding: 10px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 12px;
  pointer-events: auto;
}

.annotation-tooltip .tooltip-text q {
  font-style: italic;
  font-size: 12px;
  color: var(--color-text);
  line-height: 1.4;
}

.annotation-tooltip .tooltip-comment {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--color-bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.annotation-tooltip .tooltip-meta {
  margin-top: 4px;
  font-size: 10px;
  color: var(--color-text-faint);
}

@media (max-width: 768px) {
  .annotation-tooltip {
    position: fixed;
    left: 16px !important;
    right: 16px;
    top: auto !important;
    bottom: 16px;
    max-width: none;
    transform: none;
  }
}
</style>
