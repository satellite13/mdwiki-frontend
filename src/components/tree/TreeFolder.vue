<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import { useMovePage } from '@/composables/useMovePage'
import type { FolderTreeNode } from '@/types'
import { t } from '@/utils/i18n'
import { dndLog, dndLogDragOverThrottled } from '@/utils/dndDebug'
import { parseDndPayload, serializeDndPayload } from '@/utils/dndPayload'
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
const { movePage } = useMovePage()
const expanded = computed(() => folderStore.isExpanded(props.node.id))
const isDragOver = ref(false)

const folders = computed(() => props.node.children.filter(c => c.type === 'folder'))
const pages = computed(() => props.node.children.filter(c => c.type === 'page'))

watch(
  () => folderStore.treeDragGeneration,
  () => {
    isDragOver.value = false
  }
)

function toggle() {
  folderStore.toggleFolder(props.node.id)
}

function onDragStart(e: DragEvent) {
  if (!auth.isEditor) return
  e.dataTransfer!.setData('text/plain', serializeDndPayload({ type: 'folder', id: props.node.id }))
  e.dataTransfer!.effectAllowed = 'move'
  dndLog('folder dragstart', {
    folderId: props.node.id,
    name: props.node.name,
    types: e.dataTransfer ? [...e.dataTransfer.types] : [],
  })
}

function onDragOver(e: DragEvent) {
  if (!auth.isEditor) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  isDragOver.value = true
  const t = e.target as HTMLElement | null
  dndLogDragOverThrottled(`folder:${props.node.id}`, {
    folderId: props.node.id,
    folderName: props.node.name,
    eventTarget: t?.className ?? t?.tagName,
    currentTarget: (e.currentTarget as HTMLElement)?.className,
    depth: props.depth,
  })
}

function onDragLeave(e: DragEvent) {
  const cur = e.currentTarget as HTMLElement
  const rel = e.relatedTarget as Node | null
  if (rel && cur.contains(rel)) return
  // WebKit: relatedTarget часто null при движении внутри той же зоны — не сбрасываем (см. notifyTreeDragEnd).
  if (rel === null) return
  dndLog('folder dragleave (left folder)', {
    folderId: props.node.id,
    relatedTag: 'tagName' in rel ? (rel as HTMLElement).tagName : null,
  })
  isDragOver.value = false
}

async function onDrop(e: DragEvent) {
  if (!auth.isEditor) return
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = false
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  dndLog('folder drop (raw)', {
    folderId: props.node.id,
    folderName: props.node.name,
    rawLength: raw.length,
    raw: raw.slice(0, 200),
    dataTransferTypes: e.dataTransfer ? [...e.dataTransfer.types] : [],
  })
  const data = parseDndPayload(raw)
  dndLog('folder drop (parsed)', { folderId: props.node.id, data })
  if (!data) return
  try {
    if (data.type === 'page') {
      dndLog('folder drop → movePage', { slug: data.slug, toFolderId: props.node.id })
      await movePage(data.slug, props.node.id)
    } else if (data.type === 'folder' && data.id !== props.node.id) {
      if (folderStore.isFolderDescendant(data.id, props.node.id)) {
        dndLog('folder drop (skip descendant move)', {
          folderId: data.id,
          attemptedParentId: props.node.id,
        })
        return
      }
      dndLog('folder drop → moveFolder', { folderId: data.id, toParentId: props.node.id })
      await folderStore.moveFolder(data.id, props.node.id)
    }
  } catch (err) {
    dndLog('folder drop (api error)', { message: err instanceof Error ? err.message : String(err) })
  }
}

function onFolderDragEnd() {
  folderStore.notifyTreeDragEnd()
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
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      :draggable="auth.isEditor"
      @dragstart="onDragStart"
      @dragend="onFolderDragEnd"
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

.node-action-icon {
  font-size: 16px;
}
</style>
