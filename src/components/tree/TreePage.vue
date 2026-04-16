<script setup lang="ts">
import type { FolderTreeNode } from '@/types'

const props = defineProps<{
  node: FolderTreeNode
  depth: number
  active: boolean
}>()

const emit = defineEmits<{
  select: [slug: string]
  contextmenu: [event: MouseEvent, node: FolderTreeNode]
}>()

function onDragStart(e: DragEvent) {
  e.dataTransfer!.setData('text/plain', JSON.stringify({ type: 'page', slug: props.node.slug }))
  e.dataTransfer!.effectAllowed = 'move'
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  emit('contextmenu', e, props.node)
}
</script>

<template>
  <div
    :class="['tree-page', { active }]"
    :style="{ paddingLeft: `${depth * 16 + 24}px` }"
    draggable="true"
    @dragstart="onDragStart"
    @contextmenu="onContextMenu"
    @click="emit('select', node.slug!)"
  >
    <span class="page-icon">📄</span>
    <span class="page-name">{{ node.name }}</span>
  </div>
</template>

<style scoped>
.tree-page {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  color: var(--color-text);
  user-select: none;
}

.tree-page:hover {
  background: var(--color-bg-hover, #f0f0f0);
}

.tree-page.active {
  background: var(--color-primary);
  color: white;
}

.page-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.page-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
