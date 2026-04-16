<script setup lang="ts">
import { computed } from 'vue'
import { useFolderStore } from '@/stores/folders'
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
}>()

const folderStore = useFolderStore()
const expanded = computed(() => folderStore.isExpanded(props.node.id))

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
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
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
      :class="['folder-header', { 'drag-over': false }]"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      draggable="true"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @drop="onDrop"
      @contextmenu="onContextMenu"
      @click="toggle"
    >
      <span :class="['chevron', { expanded }]">▶</span>
      <span class="folder-icon">📁</span>
      <span class="folder-name">{{ node.name }}</span>
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
      />
      <TreePage
        v-for="page in pages"
        :key="page.id"
        :node="page"
        :depth="depth + 1"
        :active="activeSlug === page.slug"
        @select="emit('selectPage', $event)"
        @contextmenu="emit('contextmenu', $event, page)"
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
  border-radius: 4px;
  color: var(--color-text);
  user-select: none;
}

.folder-header:hover {
  background: var(--color-bg-hover, #f0f0f0);
}

.chevron {
  font-size: 8px;
  transition: transform 0.15s;
  flex-shrink: 0;
  width: 12px;
  text-align: center;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.folder-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
