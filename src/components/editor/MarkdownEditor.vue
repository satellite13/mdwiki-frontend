<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import { MdEditor, NormalToolbar, config } from 'md-editor-v3'
import { lineNumbers, tooltips } from '@codemirror/view'
import markdownItMark from 'markdown-it-mark'
import 'md-editor-v3/lib/style.css'
import { Emoji, ExportPDF, Mark } from '@vavt/v3-extension'
import '@vavt/v3-extension/lib/asset/style.css'
import { frontmatterStripPlugin, wikilinkPlugin, tagPlugin } from '@/utils/markdownPlugins'
import { wikilinkCompletions } from '@/utils/wikilinkAutocomplete'
import { uploadFile } from '@/api/uploads'

/** md-editor-v3 передаёт это в autocompletion({ override: [встроенный, ...completions] }) */
const mdEditorCompletions = [wikilinkCompletions]

let editorLineNumbersEnabled = false

/** Подсказки CodeMirror (в т.ч. completion) — вне overflow-обёрток редактора */
function codeMirrorTooltipRoot() {
  return typeof document !== 'undefined' ? document.body : undefined
}

config({
  markdownItPlugins(plugins) {
    return [
      ...plugins,
      { type: 'markdown-it' as const, plugin: markdownItMark, options: {} },
      { type: 'markdown-it' as const, plugin: frontmatterStripPlugin, options: {} },
      { type: 'markdown-it' as const, plugin: wikilinkPlugin, options: {} },
      { type: 'markdown-it' as const, plugin: tagPlugin, options: {} }
    ]
  },
  codeMirrorExtensions(extensions) {
    const baseExtensions = extensions.filter((item) => item.type !== 'lineNumbers')
    const parent = codeMirrorTooltipRoot()
    const tooltipExt = parent
      ? [{ type: 'codemirrorTooltipsRoot', extension: tooltips({ parent }) }]
      : []
    if (!editorLineNumbersEnabled) {
      return [...baseExtensions, ...tooltipExt]
    }
    return [
      ...baseExtensions,
      ...tooltipExt,
      {
        type: 'lineNumbers',
        extension: lineNumbers()
      }
    ]
  }
})

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const showLineNumbers = ref(editorLineNumbersEnabled)
const editorKey = ref(0)
const isPreviewOnly = ref(false)
const uploadError = ref('')
const wrapperRef = ref<HTMLElement | null>(null)
const editorRef = ref<any>(null)
let modeObserver: MutationObserver | null = null

function toggleLineNumbers() {
  // md-editor-v3 does not support reactive CodeMirror extension changes, so we
  // must recreate the editor instance by bumping the key. We save and restore
  // the cursor (scroll) position to minimise user disruption.
  const cmView = wrapperRef.value?.querySelector('.cm-editor') as HTMLElement | null
  const scrollTop = cmView?.querySelector('.cm-scroller')?.scrollTop ?? 0

  showLineNumbers.value = !showLineNumbers.value
  editorLineNumbersEnabled = showLineNumbers.value
  editorKey.value++

  nextTick(() => {
    const newScroller = wrapperRef.value?.querySelector('.cm-scroller') as HTMLElement | null
    if (newScroller) {
      newScroller.scrollTop = scrollTop
    }
  })
}

function onSave() {
  emit('save')
}

async function onUploadImg(files: Array<File>, callback: (urls: string[]) => void) {
  uploadError.value = ''
  try {
    const urls = await Promise.all(files.map((file) => uploadFile(file)))
    callback(urls)
  } catch (error) {
    console.error('Image upload failed', error)
    if (axios.isAxiosError(error)) {
      uploadError.value = error.response?.data?.message || 'Image upload failed'
    } else {
      uploadError.value = 'Image upload failed'
    }
  }
}

function syncPreviewOnlyState() {
  const editorEl = wrapperRef.value?.querySelector('.md-editor')
  isPreviewOnly.value = !!editorEl?.classList.contains('md-editor-previewOnly')
}

function exitPreviewOnly() {
  editorRef.value?.togglePreviewOnly?.(false)
  setTimeout(syncPreviewOnlyState, 0)
}

onMounted(() => {
  const editorEl = wrapperRef.value?.querySelector('.md-editor')
  if (!editorEl) return

  syncPreviewOnlyState()
  modeObserver = new MutationObserver(syncPreviewOnlyState)
  modeObserver.observe(editorEl, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  modeObserver?.disconnect()
  modeObserver = null
})
</script>

<template>
  <div ref="wrapperRef" class="markdown-editor-wrapper">
    <button v-if="isPreviewOnly" class="preview-exit-btn" @click="exitPreviewOnly">
      Exit preview
    </button>
    <MdEditor
      ref="editorRef"
      :key="editorKey"
      :modelValue="props.modelValue"
      :completions="mdEditorCompletions"
      @update:modelValue="emit('update:modelValue', $event)"
      @onSave="onSave"
      @onUploadImg="onUploadImg"
      language="en-US"
      previewTheme="default"
      :showCodeRowNumber="showLineNumbers"
      :toolbars="['bold', 'underline', 'italic', 'strikeThrough', '-', 'title', 'sub', 'sup', 'quote', '-', 'unorderedList', 'orderedList', 'task', '-', 'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex', '-', 0, 1, 2, 'revoke', 'next', 'save', '=', 3, 'prettier', 'pageFullscreen', 'fullscreen', 'preview', 'previewOnly', 'catalog']"
      style="height: 100%"
    >
      <template #defToolbars>
        <Mark title="Mark" />
        <Emoji title="Emoji" />
        <ExportPDF :modelValue="props.modelValue" title="Export as PDF" />
        <NormalToolbar :title="showLineNumbers ? 'Hide line numbers' : 'Show line numbers'" @onClick="toggleLineNumbers">
          <template #trigger>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" :stroke="showLineNumbers ? 'var(--color-primary)' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="6" x2="4" y2="6.01" />
              <line x1="4" y1="12" x2="4" y2="12.01" />
              <line x1="4" y1="18" x2="4" y2="18.01" />
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
            </svg>
          </template>
        </NormalToolbar>
      </template>
    </MdEditor>
    <p v-if="uploadError" class="upload-error">
      {{ uploadError }}
    </p>
  </div>
</template>

<style scoped>
.markdown-editor-wrapper {
  height: 100%;
  position: relative;
}

.preview-exit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 12px;
}

.preview-exit-btn:hover {
  background: var(--color-bg-hover);
}

.markdown-editor-wrapper :deep(.md-editor-previewOnly .md-editor-toolbar-wrapper) {
  display: none;
}

.markdown-editor-wrapper :deep(.emoji-container .emojis li) {
  /* Override tight defaults from v3-extension to avoid clipping color emoji glyphs */
  height: auto;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  overflow: visible;
  float: none;
  width: auto;
  margin: 0;
}

.markdown-editor-wrapper :deep(.emoji-container .emojis) {
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  grid-auto-rows: 32px;
  width: 352px;
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

</style>
