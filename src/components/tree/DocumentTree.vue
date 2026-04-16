<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import type { FolderTreeNode } from '@/types'
import TreeFolder from './TreeFolder.vue'
import TreePage from './TreePage.vue'
import TreeContextMenu from './TreeContextMenu.vue'

const router = useRouter()
const route = useRoute()
const folderStore = useFolderStore()
const auth = useAuthStore()

const activeSlug = computed(() => (route.params.slug as string) || null)

// Context menu state
const contextMenu = ref<{ x: number; y: number; node: FolderTreeNode | null; parentId: string | null } | null>(null)

const contextMenuItems = computed(() => {
  if (!auth.isEditor) return []
  const items = [
    { label: 'New Page', action: 'new-page' },
    { label: 'New Folder', action: 'new-folder' },
  ]
  if (contextMenu.value?.node) {
    items.push({ label: 'Rename', action: 'rename' })
    items.push({ label: 'Delete', action: 'delete', danger: true } as any)
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

async function onContextAction(action: string) {
  const ctx = contextMenu.value
  if (!ctx) return

  if (action === 'new-page') {
    const title = prompt('Page title:')
    if (!title) return
    const slug = title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/(^-|-$)/g, '')
    const folderId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
    const { createPage } = await import('@/api/pages')
    await createPage(slug, title, '', folderId || undefined)
    await folderStore.fetchTree(true)
    router.push(`/page/${slug}`)
  } else if (action === 'new-folder') {
    const name = prompt('Folder name:')
    if (!name) return
    const parentId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
    await folderStore.createFolder(name, parentId || undefined)
  } else if (action === 'rename' && ctx.node) {
    const newName = prompt('New name:', ctx.node.name)
    if (!newName || newName === ctx.node.name) return
    if (ctx.node.type === 'folder') {
      await folderStore.renameFolder(ctx.node.id, newName)
    }
    // Page rename would need a different API (update title)
  } else if (action === 'delete' && ctx.node) {
    if (!confirm(`Delete "${ctx.node.name}"?`)) return
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

function onRootDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
}

function onRootDrop(e: DragEvent) {
  e.preventDefault()
  try {
    const data = JSON.parse(e.dataTransfer!.getData('text/plain'))
    if (data.type === 'page') {
      folderStore.movePage(data.slug, null as any)
    } else if (data.type === 'folder') {
      folderStore.moveFolder(data.id, null as any)
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  folderStore.fetchTree()
})
</script>

<template>
  <div
    class="document-tree"
    @contextmenu="onRootContextMenu"
    @dragover="onRootDragOver"
    @drop="onRootDrop"
  >
    <div class="tree-header">
      <span class="tree-title">Documents</span>
    </div>

    <div v-if="folderStore.loading" class="tree-loading">Loading...</div>
    <div v-else class="tree-content">
      <TreeFolder
        v-for="folder in rootFolders"
        :key="folder.id"
        :node="folder"
        :depth="0"
        :activeSlug="activeSlug"
        @selectPage="onSelectPage"
        @contextmenu="onContextMenu"
      />
      <TreePage
        v-for="page in rootPages"
        :key="page.id"
        :node="page"
        :depth="0"
        :active="activeSlug === page.slug"
        @select="onSelectPage"
        @contextmenu="onContextMenu"
      />
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
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.tree-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
}

.tree-content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.tree-loading {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
