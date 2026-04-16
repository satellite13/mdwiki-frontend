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
    :toolbars="['bold', 'italic', 'strikeThrough', '-', 'title', 'unorderedList', 'orderedList', 'task', '-', 'codeRow', 'code', 'link', 'table', '-', 'revoke', 'next', '=', 'preview']"
    style="height: 100%"
  />
</template>
