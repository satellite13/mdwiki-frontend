<script setup lang="ts">
import { ref } from 'vue'
import { MdEditor, NormalToolbar, config } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { wikilinkPlugin, tagPlugin } from '@/utils/markdownPlugins'

config({
  markdownItPlugins(plugins) {
    return [
      ...plugins,
      { type: 'markdown-it' as const, plugin: wikilinkPlugin, options: {} },
      { type: 'markdown-it' as const, plugin: tagPlugin, options: {} }
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

const showLineNumbers = ref(false)

function toggleLineNumbers() {
  showLineNumbers.value = !showLineNumbers.value
}

function onSave() {
  emit('save')
}
</script>

<template>
  <MdEditor
    :modelValue="props.modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    @onSave="onSave"
    language="en-US"
    previewTheme="default"
    :showCodeRowNumber="showLineNumbers"
    :toolbars="['bold', 'underline', 'italic', 'strikeThrough', '-', 'title', 'sub', 'sup', 'quote', '-', 'unorderedList', 'orderedList', 'task', '-', 'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex', '-', 'revoke', 'next', 'save', 'prettier', '=', 0, 'pageFullscreen', 'fullscreen', 'preview', 'previewOnly', 'catalog']"
    style="height: 100%"
  >
    <template #defToolbars>
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
</template>
