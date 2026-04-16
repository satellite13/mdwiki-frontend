<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { WikilinkExtension } from './WikilinkExtension'
import { TagExtension } from './TagExtension'
import { watch } from 'vue'
import { editorHtmlToMarkdown, markdownToEditorHtml } from '@/utils/editorMarkdown'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: markdownToEditorHtml(props.modelValue),
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Start writing...' }),
    WikilinkExtension,
    TagExtension
  ],
  onUpdate: ({ editor: ed }) => {
    emit('update:modelValue', editorHtmlToMarkdown(ed.getHTML()))
  },
})

watch(() => props.modelValue, (newVal) => {
  const ed = editor.value
  if (!ed) return
  const fromEditor = editorHtmlToMarkdown(ed.getHTML())
  if (fromEditor.trim() === (newVal ?? '').trim()) return
  ed.commands.setContent(markdownToEditorHtml(newVal ?? ''), { emitUpdate: false })
})
</script>

<template>
  <div class="tiptap-editor">
    <div class="toolbar" v-if="editor">
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ active: editor.isActive('bold') }">B</button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ active: editor.isActive('italic') }">I</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ active: editor.isActive('heading', { level: 1 }) }">H1</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor.isActive('heading', { level: 2 }) }">H2</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: editor.isActive('heading', { level: 3 }) }">H3</button>
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ active: editor.isActive('bulletList') }">List</button>
      <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }">Code</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.tiptap-editor { border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }
.toolbar { display: flex; gap: 4px; padding: 8px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-secondary); }
.toolbar button { padding: 4px 8px; font-size: 13px; background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer; }
.toolbar button:hover { background: var(--color-border); }
.toolbar button.active { background: var(--color-primary); color: white; }
.editor-content { padding: 16px; min-height: 300px; }
.editor-content :deep(.tiptap) { outline: none; min-height: 280px; }
.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder); color: var(--color-text-muted); float: left; pointer-events: none; height: 0;
}
</style>
