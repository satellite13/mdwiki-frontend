<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import type { FolderTreeNode } from '@/types'
import { createTreeEventsSource } from '@/api/events'
import TreeFolder from './TreeFolder.vue'
import TreePage from './TreePage.vue'
import TreeContextMenu from './TreeContextMenu.vue'

const router = useRouter()
const route = useRoute()
const folderStore = useFolderStore()
const auth = useAuthStore()

const activeSlug = computed(() => (route.params.slug as string) || null)
const TREE_EVENTS_RECONNECT_MS = 3000
let treeEventsSource: EventSource | null = null
let treeReconnectTimer: ReturnType<typeof setTimeout> | null = null
let treeRefreshInFlight = false

// Context menu state
const contextMenu = ref<{ x: number; y: number; node: FolderTreeNode | null; parentId: string | null } | null>(null)

const contextMenuItems = computed(() => {
  if (!auth.isEditor) return []
  const items: { label: string; action: string; danger?: boolean }[] = []

  if (!contextMenu.value?.node || contextMenu.value.node.type === 'folder') {
    items.push({ label: 'Новая страница', action: 'new-page' })
    items.push({ label: 'Новая папка', action: 'new-folder' })
  }
  if (contextMenu.value?.node) {
    if (contextMenu.value.node.type === 'folder') {
      items.push({ label: 'Переименовать', action: 'rename' })
    }
    items.push({ label: 'Удалить', action: 'delete', danger: true })
  }
  return items
})

const rootFolders = computed(() => folderStore.tree.filter(n => n.type === 'folder'))
const rootPages = computed(() => folderStore.tree.filter(n => n.type === 'page'))

function onSelectPage(slug: string) {
  router.push(`/page/${slug}`)
}

function onContextMenu(event: MouseEvent, node: FolderTreeNode) {
  const parentId = node.type === 'folder' ? node.id : null
  contextMenu.value = { x: event.clientX, y: event.clientY, node, parentId }
}

function onRootContextMenu(e: MouseEvent) {
  e.preventDefault()
  contextMenu.value = { x: e.clientX, y: e.clientY, node: null, parentId: null }
}

async function createNewPage(folderId?: string) {
  const title = prompt('Название страницы:')
  if (!title) return
  const slug = title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/(^-|-$)/g, '')
  const { createPage } = await import('@/api/pages')
  await createPage(slug, title, '', folderId || undefined)
  await folderStore.fetchTree(true)
  router.push(`/page/${slug}`)
}

async function createNewFolder(parentId?: string) {
  const name = prompt('Название папки:')
  if (!name) return
  await folderStore.createFolder(name, parentId || undefined)
}

async function onContextAction(action: string) {
  const ctx = contextMenu.value
  if (!ctx) return

  if (action === 'new-page') {
    const folderId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
    await createNewPage(folderId || undefined)
  } else if (action === 'new-folder') {
    const parentId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
    await createNewFolder(parentId || undefined)
  } else if (action === 'rename' && ctx.node) {
    const newName = prompt('Новое имя:', ctx.node.name)
    if (!newName || newName === ctx.node.name) return
    if (ctx.node.type === 'folder') {
      await folderStore.renameFolder(ctx.node.id, newName)
    }
  } else if (action === 'delete' && ctx.node) {
    if (!confirm(`Удалить "${ctx.node.name}"?`)) return
    if (ctx.node.type === 'folder') {
      await folderStore.deleteFolder(ctx.node.id)
    } else if (ctx.node.slug) {
      const { deletePage } = await import('@/api/pages')
      await deletePage(ctx.node.slug)
      await folderStore.fetchTree(true)
      if (activeSlug.value === ctx.node.slug) router.push('/')
    }
  }

  contextMenu.value = null
}

async function onDeleteNode(node: FolderTreeNode) {
  if (!confirm(`Удалить "${node.name}"?`)) return
  if (node.type === 'folder') {
    await folderStore.deleteFolder(node.id)
  } else if (node.slug) {
    const { deletePage } = await import('@/api/pages')
    await deletePage(node.slug)
    await folderStore.fetchTree(true)
    if (activeSlug.value === node.slug) router.push('/')
  }
}

async function onAddPageToFolder(folderId: string) {
  await createNewPage(folderId)
}

async function onAddSubfolder(parentId: string) {
  await createNewFolder(parentId)
}

// Drag & drop on root (move to root level)
const rootDragOver = ref(false)

function onRootDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  rootDragOver.value = true
}

function onRootDragLeave() {
  rootDragOver.value = false
}

function onRootDrop(e: DragEvent) {
  e.preventDefault()
  rootDragOver.value = false
  try {
    const data = JSON.parse(e.dataTransfer!.getData('text/plain'))
    if (data.type === 'page') {
      folderStore.movePage(data.slug, null)
    } else if (data.type === 'folder') {
      folderStore.moveFolder(data.id, null)
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  folderStore.fetchTree()
  connectTreeEvents()
})

onBeforeUnmount(() => {
  disconnectTreeEvents()
  if (treeReconnectTimer) {
    clearTimeout(treeReconnectTimer)
    treeReconnectTimer = null
  }
})

async function refreshTree() {
  if (treeRefreshInFlight) return
  treeRefreshInFlight = true
  try {
    await folderStore.fetchTree(true)
  } finally {
    treeRefreshInFlight = false
  }
}

function connectTreeEvents() {
  const token = auth.token || localStorage.getItem('token')
  if (!token) return

  disconnectTreeEvents()

  treeEventsSource = createTreeEventsSource(token)
  treeEventsSource.addEventListener('tree-updated', () => {
    refreshTree()
  })
  treeEventsSource.onerror = () => {
    disconnectTreeEvents()
    if (treeReconnectTimer) return
    treeReconnectTimer = setTimeout(() => {
      treeReconnectTimer = null
      connectTreeEvents()
    }, TREE_EVENTS_RECONNECT_MS)
  }
}

function disconnectTreeEvents() {
  if (!treeEventsSource) return
  treeEventsSource.close()
  treeEventsSource = null
}
</script>

<template>
  <div
    class="document-tree"
    @contextmenu="onRootContextMenu"
    @dragover="onRootDragOver"
    @dragleave="onRootDragLeave"
    @drop="onRootDrop"
  >
    <div class="tree-header">
      <span class="tree-title">Документы</span>
      <div v-if="auth.isEditor" class="tree-actions">
        <button class="tree-action-btn" title="Новая страница" @click.stop="createNewPage()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 1h7l3 3v11H3V1z" stroke="currentColor" stroke-width="1.3"/><path d="M5 9h6M8 6v6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button class="tree-action-btn" title="Новая папка" @click.stop="createNewFolder()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 3h5l2 2h7v9H1V3z" stroke="currentColor" stroke-width="1.3"/><path d="M5 9h6M8 6.5v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <div v-if="folderStore.loading" class="tree-loading">Загрузка...</div>
    <div v-else :class="['tree-content', { 'root-drag-over': rootDragOver }]">
      <TreeFolder
        v-for="folder in rootFolders"
        :key="folder.id"
        :node="folder"
        :depth="0"
        :activeSlug="activeSlug"
        @selectPage="onSelectPage"
        @contextmenu="onContextMenu"
        @delete="onDeleteNode"
        @addPage="onAddPageToFolder"
        @addSubfolder="onAddSubfolder"
      />
      <TreePage
        v-for="page in rootPages"
        :key="page.id"
        :node="page"
        :depth="0"
        :active="activeSlug === page.slug"
        @select="onSelectPage"
        @contextmenu="onContextMenu"
        @delete="onDeleteNode"
      />

      <div v-if="!folderStore.loading && folderStore.tree.length === 0" class="tree-empty">
        Нет документов
      </div>
    </div>

    <TreeContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenuItems"
      @action="onContextAction"
      @close="contextMenu = null"
    />
  </div>
</template>

<style scoped>
.document-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.tree-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tree-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
}

.tree-actions {
  display: flex;
  gap: 2px;
}

.tree-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.tree-action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.tree-content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  transition: background 0.15s;
}

.tree-content.root-drag-over {
  background: rgba(91, 95, 199, 0.06);
}

.tree-loading {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.tree-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--color-text-faint);
  font-size: 13px;
}
</style>
