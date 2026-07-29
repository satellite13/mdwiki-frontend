<script setup lang="ts">
import { computed } from 'vue'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import { useTreeDragSource, useTreeDropTarget } from '@/composables/useTreeDnd'
import type { FolderTreeNode } from '@/types'
import { t } from '@/utils/i18n'
import TreePage from './TreePage.vue'

const props = defineProps<{
  node: FolderTreeNode
  depth: number
  activeSlug: string | null
  staggerIndex?: number
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

const folders = computed(() => props.node.children.filter(c => c.type === 'folder'))
const pages = computed(() => props.node.children.filter(c => c.type === 'page'))

const { isDragOver, onDragOver, onDragLeave, onDrop } = useTreeDropTarget({
  targetFolderId: props.node.id,
  zoneLabel: 'folder',
  dragOverLogKey: `folder:${props.node.id}`,
  stopOnDrop: true,
  logContext: () => ({ folderId: props.node.id, folderName: props.node.name, depth: props.depth })
})

const { onDragStart, onDragEnd } = useTreeDragSource({
  payload: () => ({ type: 'folder', id: props.node.id }),
  zoneLabel: 'folder',
  logContext: () => ({ folderId: props.node.id, name: props.node.name })
})

function toggle() {
  folderStore.toggleFolder(props.node.id)
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  emit('contextmenu', e, props.node)
}
</script>

<template>
  <div
    class="tree-folder"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      :class="['folder-header', { 'drag-over': isDragOver }]"
      :style="{ paddingLeft: `${depth * 16 + 8}px`, '--stagger-index': staggerIndex ?? 0 }"
      :draggable="auth.isEditor"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
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
        <button class="node-action" :title="t.tree.addPage" @click="emit('addPage', node.id)">
          <span class="material-symbols-outlined node-action-icon notranslate" translate="no">note_add</span>
        </button>
        <button class="node-action" :title="t.tree.addSubfolder" @click="emit('addSubfolder', node.id)">
          <span class="material-symbols-outlined node-action-icon notranslate" translate="no">create_new_folder</span>
        </button>
        <button class="node-action danger" :title="t.tree.deleteFolder" @click="emit('delete', node)">
          <span class="material-symbols-outlined node-action-icon notranslate" translate="no">delete</span>
        </button>
      </span>
    </div>

    <Transition name="folder-expand">
      <div v-if="expanded" class="folder-children">
        <TreeFolder
          v-for="(child, idx) in folders"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
          :staggerIndex="(staggerIndex ?? 0) + idx"
          :activeSlug="activeSlug"
          @selectPage="emit('selectPage', $event)"
          @contextmenu="emit('contextmenu', $event, child)"
          @delete="emit('delete', $event)"
          @addPage="emit('addPage', $event)"
          @addSubfolder="emit('addSubfolder', $event)"
        />
        <TreePage
          v-for="(page, idx) in pages"
          :key="page.id"
          :node="page"
          :depth="depth + 1"
          :staggerIndex="(staggerIndex ?? 0) + folders.length + idx"
          :active="activeSlug === page.slug"
          @select="emit('selectPage', $event)"
          @contextmenu="emit('contextmenu', $event, page)"
          @delete="emit('delete', $event)"
        />
      </div>
    </Transition>
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

.node-action-icon {
  font-size: 16px;
}

@media (prefers-reduced-motion: no-preference) {
  .folder-header {
    animation: fadeInUp 0.3s ease both;
    animation-delay: calc(var(--stagger-index, 0) * 20ms);
  }

  .folder-header:hover .folder-icon {
    transform: scale(1.01);
  }

  .folder-expand-enter-active {
    overflow: hidden;
    transition: max-height 0.3s ease-out, opacity 0.25s ease-out;
  }

  .folder-expand-leave-active {
    overflow: hidden;
    transition: max-height 0.25s ease-in, opacity 0.2s ease-in;
  }

  .folder-expand-enter-from,
  .folder-expand-leave-to {
    max-height: 0;
    opacity: 0;
  }

  .folder-expand-enter-to,
  .folder-expand-leave-from {
    max-height: 3000px;
    opacity: 1;
  }
}
</style>
