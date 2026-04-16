<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import type { FolderTreeNode } from '@/types'
import TreePage from './TreePage.vue'

const props = defineProps<{
  node: FolderTreeNode
  depth: number
  activeSlug: string | null
}>()

const emit = defineEmits<{
  selectPage: [slug: string]
  contextmenu: [event: MouseEvent, node: FolderTreeNode]
  delete: [node: FolderTreeNode]
  addPage: [folderId: string]
  addSubfolder: [parentId: string]
}>()

const folderStore = useFolderStore()
const auth = useAuthStore()
const expanded = computed(() => folderStore.isExpanded(props.node.id))
const isDragOver = ref(false)

const folders = computed(() => props.node.children.filter(c => c.type === 'folder'))
const pages = computed(() => props.node.children.filter(c => c.type === 'page'))

function toggle() {
  folderStore.toggleFolder(props.node.id)
}

function onDragStart(e: DragEvent) {
  e.dataTransfer!.setData('text/plain', JSON.stringify({ type: 'folder', id: props.node.id }))
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = false
  try {
    const data = JSON.parse(e.dataTransfer!.getData('text/plain'))
    if (data.type === 'page') {
      folderStore.movePage(data.slug, props.node.id)
    } else if (data.type === 'folder' && data.id !== props.node.id) {
      folderStore.moveFolder(data.id, props.node.id)
    }
  } catch { /* ignore invalid drag data */ }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  emit('contextmenu', e, props.node)
}
</script>

<template>
  <div class="tree-folder">
    <div
      :class="['folder-header', { 'drag-over': isDragOver }]"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      draggable="true"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @contextmenu="onContextMenu"
      @click="toggle"
    >
      <span :class="['chevron', { expanded }]">&#9654;</span>
      <span class="folder-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M1.5 3.5h5l1.5 1.5h6.5v8.5h-13v-10z" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
      </span>
      <span class="folder-name">{{ node.name }}</span>

      <span v-if="auth.isEditor" class="folder-actions" @click.stop>
        <button class="node-action" title="Добавить страницу" @click="emit('addPage', node.id)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="node-action" title="Добавить подпапку" @click="emit('addSubfolder', node.id)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M1 4h5l1.5 1.5H14v7H1V4z" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 8.5h5M8 6v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
        <button class="node-action danger" title="Удалить папку" @click="emit('delete', node)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </span>
    </div>

    <div v-if="expanded" class="folder-children">
      <TreeFolder
        v-for="child in folders"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :activeSlug="activeSlug"
        @selectPage="emit('selectPage', $event)"
        @contextmenu="emit('contextmenu', $event, child)"
        @delete="emit('delete', $event)"
        @addPage="emit('addPage', $event)"
        @addSubfolder="emit('addSubfolder', $event)"
      />
      <TreePage
        v-for="page in pages"
        :key="page.id"
        :node="page"
        :depth="depth + 1"
        :active="activeSlug === page.slug"
        @select="emit('selectPage', $event)"
        @contextmenu="emit('contextmenu', $event, page)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.folder-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  color: var(--color-text);
  user-select: none;
  transition: background 0.15s;
}

.folder-header:hover {
  background: var(--color-bg-hover);
}

.folder-header.drag-over {
  background: var(--color-primary-light);
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
}

.chevron {
  font-size: 8px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  width: 12px;
  text-align: center;
  color: var(--color-text-faint);
}

.chevron.expanded {
  transform: rotate(90deg);
}

.folder-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color 0.15s;
}

.chevron.expanded + .folder-icon {
  color: var(--color-primary);
}

.folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.folder-children {
  border-left: 1px solid var(--color-border);
  margin-left: 18px;
}

.folder-actions {
  display: none;
  gap: 1px;
  margin-left: auto;
  flex-shrink: 0;
}

.folder-header:hover .folder-actions {
  display: flex;
}

.node-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.1s;
}

.node-action:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
}

.node-action.danger:hover {
  background: rgba(207, 34, 46, 0.08);
  color: var(--color-danger);
}
</style>
