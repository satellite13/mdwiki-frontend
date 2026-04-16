<script setup lang="ts">
import { MdEditor, config } from 'md-editor-v3'
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
    :toolbars="['bold', 'underline', 'italic', 'strikeThrough', '-', 'title', 'sub', 'sup', 'quote', '-', 'unorderedList', 'orderedList', 'task', '-', 'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex', '-', 'revoke', 'next', 'save', 'prettier', '=', 'pageFullscreen', 'fullscreen', 'preview', 'previewOnly', 'catalog']"
    style="height: 100%"
  />
</template>
