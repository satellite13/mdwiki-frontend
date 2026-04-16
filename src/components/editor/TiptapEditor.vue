<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { WikilinkExtension } from './WikilinkExtension'
import { TagExtension } from './TagExtension'
import { watch, onBeforeUnmount } from 'vue'
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

onBeforeUnmount(() => {
  editor.value?.destroy()
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
      <span class="toolbar-divider"></span>
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ active: editor.isActive('heading', { level: 1 }) }">H1</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor.isActive('heading', { level: 2 }) }">H2</button>
      <button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: editor.isActive('heading', { level: 3 }) }">H3</button>
      <span class="toolbar-divider"></span>
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ active: editor.isActive('bulletList') }">List</button>
      <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }">Code</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.tiptap-editor {
  border: 1px solid #3a3a3a;
  border-radius: var(--radius);
  overflow: hidden;
  background: #1e1e1e;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 10px;
  border-bottom: 1px solid #3a3a3a;
  background: #262626;
}

.toolbar button {
  padding: 5px 10px;
  font-size: 13px;
  font-family: var(--font-body);
  font-weight: 600;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  color: #999999;
  transition: all 0.15s ease;
}

.toolbar button:hover {
  background: #333333;
  color: #dcddde;
}

.toolbar button.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: #3a3a3a;
  margin: 0 4px;
}

.editor-content {
  padding: 24px;
  min-height: 300px;
  background: #1e1e1e;
}

.editor-content :deep(.tiptap) {
  outline: none;
  min-height: 280px;
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.8;
  color: #dcddde;
}

.editor-content :deep(.tiptap h1),
.editor-content :deep(.tiptap h2),
.editor-content :deep(.tiptap h3) {
  font-family: var(--font-body);
}

.editor-content :deep(.tiptap code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: #2d2d2d;
  padding: 2px 6px;
  border-radius: 3px;
}

.editor-content :deep(.tiptap pre) {
  font-family: var(--font-mono);
  background: #2d2d2d;
  padding: 14px 18px;
  border-radius: var(--radius);
  border: 1px solid #3a3a3a;
  font-size: 14px;
}

.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #666666;
  float: left;
  pointer-events: none;
  height: 0;
  font-style: italic;
}
</style>
