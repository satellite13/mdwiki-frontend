<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { useMovePage } from '@/composables/useMovePage'
import { usePageTags } from '@/composables/usePageTags'
import { useTreeSse } from '@/composables/useTreeSse'
import { useTreeActions } from '@/composables/useTreeActions'
import { invalidatePageIndex } from '@/services/pageIndex'
import { parseDndPayload } from '@/utils/dndPayload'
import { t } from '@/utils/i18n'
import { dndLog, dndLogDragOverThrottled } from '@/utils/dndDebug'
import type { FolderTreeNode } from '@/types'
import TreeFolder from './TreeFolder.vue'
import TreePage from './TreePage.vue'
import TreeContextMenu from './TreeContextMenu.vue'

const router = useRouter()
const route = useRoute()
const folderStore = useFolderStore()
const auth = useAuthStore()
const dialog = useDialogStore()
const { movePage } = useMovePage()

const activeSlug = computed(() => (route.params.slug as string) || null)

const {
  tagStore,
  tagsLoading,
  selectedTags,
  tagsCollapsed,
  tagQuery,
  filteredTags,
  filterTreeByTags,
  toggleTagFilter,
  clearTagFilter,
  toggleTagsPanel,
  refreshTagData
} = usePageTags()

const treeActions = useTreeActions({ getActiveSlug: () => activeSlug.value })

const contextMenu = ref<{ x: number; y: number; node: FolderTreeNode | null; parentId: string | null } | null>(null)
let treeRefreshInFlight = false

const contextMenuItems = computed(() => {
  if (!auth.isEditor) return []
  const items: { label: string; action: string; danger?: boolean }[] = []

  if (!contextMenu.value?.node || contextMenu.value.node.type === 'folder') {
    items.push({ label: t.tree.newPage, action: 'new-page' })
    items.push({ label: t.tree.newFolder, action: 'new-folder' })
  }
  if (contextMenu.value?.node) {
    if (contextMenu.value.node.type === 'folder') {
      items.push({ label: t.tree.rename, action: 'rename' })
    }
    items.push({ label: t.tree.delete, action: 'delete', danger: true })
  }
  return items
})

const visibleTree = computed(() => {
  if (selectedTags.value.length === 0) return folderStore.tree
  return filterTreeByTags(folderStore.tree, selectedTags.value)
})
const rootFolders = computed(() => visibleTree.value.filter((n) => n.type === 'folder'))
const rootPages = computed(() => visibleTree.value.filter((n) => n.type === 'page'))

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

  try {
    if (action === 'new-page') {
      const folderId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
      await treeActions.createNewPage(folderId || undefined)
    } else if (action === 'new-folder') {
      const parentId = ctx.node?.type === 'folder' ? ctx.node.id : ctx.parentId
      await treeActions.createNewFolder(parentId || undefined)
    } else if (action === 'rename' && ctx.node?.type === 'folder') {
      await treeActions.renameFolderNode(ctx.node)
    } else if (action === 'delete' && ctx.node) {
      await treeActions.deleteNode(ctx.node)
      await refreshTagData(true)
    }
  } catch (e) {
    console.error('Context action failed:', e)
    await dialog.alert(t.errors.operationFailed)
  }

  contextMenu.value = null
}

async function onDeleteNode(node: FolderTreeNode) {
  await treeActions.deleteNode(node)
  await refreshTagData(true)
}

async function onAddPageToFolder(folderId: string) {
  await treeActions.createNewPage(folderId)
}

async function onAddSubfolder(parentId: string) {
  await treeActions.createNewFolder(parentId)
}

const rootDragOver = ref(false)

watch(
  () => folderStore.treeDragGeneration,
  () => {
    rootDragOver.value = false
  }
)

function onRootDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  rootDragOver.value = true
  const target = e.target as HTMLElement | null
  dndLogDragOverThrottled('root:document-tree', {
    eventTarget: target?.className ?? target?.tagName
  })
}

function onRootDragLeave(e: DragEvent) {
  const cur = e.currentTarget as HTMLElement
  const rel = e.relatedTarget as Node | null
  if (rel && cur.contains(rel)) return
  if (rel === null) return
  dndLog('root dragleave (left tree)', {
    relatedTag: 'tagName' in rel ? (rel as HTMLElement).tagName : null
  })
  rootDragOver.value = false
}

async function onRootDrop(e: DragEvent) {
  e.preventDefault()
  rootDragOver.value = false
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  dndLog('root drop (raw)', {
    rawLength: raw.length,
    raw: raw.slice(0, 200),
    types: e.dataTransfer ? [...e.dataTransfer.types] : []
  })
  const data = parseDndPayload(raw)
  dndLog('root drop (parsed)', { data })
  if (!data) return
  try {
    if (data.type === 'page') {
      dndLog('root drop → movePage', { slug: data.slug, toRoot: true })
      await movePage(data.slug, null)
    } else if (data.type === 'folder') {
      dndLog('root drop → moveFolder', { folderId: data.id, toRoot: true })
      await folderStore.moveFolder(data.id, null)
    }
  } catch (err) {
    dndLog('root drop (api error)', { message: err instanceof Error ? err.message : String(err) })
  }
}

async function refreshTree() {
  if (treeRefreshInFlight) return
  treeRefreshInFlight = true
  try {
    invalidatePageIndex()
    await Promise.all([folderStore.fetchTree(true), refreshTagData(true)])
  } catch (error) {
    console.error('Failed to refresh tree', error)
  } finally {
    treeRefreshInFlight = false
  }
}

useTreeSse({ onTreeUpdated: refreshTree })

onMounted(async () => {
  await folderStore.fetchTree()
  await refreshTagData()
})
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
      <span class="tree-title">{{ t.tree.documents }}</span>
      <div v-if="auth.isEditor" class="tree-actions">
        <button class="tree-action-btn" :title="t.tree.newPage" @click.stop="treeActions.createNewPage()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 1h7l3 3v11H3V1z" stroke="currentColor" stroke-width="1.3"/><path d="M5 9h6M8 6v6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button class="tree-action-btn" :title="t.tree.newFolder" @click.stop="treeActions.createNewFolder()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 3h5l2 2h7v9H1V3z" stroke="currentColor" stroke-width="1.3"/><path d="M5 9h6M8 6.5v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>

    <div class="tags-panel">
      <div class="tags-panel-header">
        <button class="tags-toggle-btn" type="button" @click="toggleTagsPanel">
          <span class="tree-title">{{ t.tree.tags }}</span>
          <span :class="['tags-chevron', { collapsed: tagsCollapsed }]">▾</span>
        </button>
        <button
          v-if="selectedTags.length > 0"
          class="clear-tag-btn"
          type="button"
          @click="clearTagFilter"
        >
          {{ t.tree.clearFilter }}
        </button>
      </div>
      <div v-if="!tagsCollapsed" class="tags-panel-body">
        <input
          v-model="tagQuery"
          class="tags-search-input"
          type="search"
          :placeholder="t.tree.searchTag"
        />
        <div v-if="tagsLoading" class="tags-loading">{{ t.tree.loadingTags }}</div>
        <div v-else-if="tagStore.tags.length === 0" class="tags-empty">{{ t.tree.noTags }}</div>
        <div v-else-if="filteredTags.length === 0" class="tags-empty">{{ t.tree.tagsNotFound }}</div>
        <div v-else class="tags-list">
          <button
            v-for="tag in filteredTags"
            :key="tag.id"
            :class="['tag-chip', { active: selectedTags.includes(tag.name) }]"
            type="button"
            @click="toggleTagFilter(tag.name)"
          >
            <span class="tag-name">#{{ tag.name }}</span>
            <span class="tag-count">{{ tag.pageCount }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="folderStore.loading" class="tree-loading">{{ t.tree.loading }}</div>
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

      <div v-if="!folderStore.loading && visibleTree.length === 0" class="tree-empty">
        <template v-if="selectedTags.length > 0">{{ t.tree.noDocumentsWithTag(selectedTags) }}</template>
        <template v-else>{{ t.tree.noDocuments }}</template>
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
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tree-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--color-text-faint);
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

.tags-panel {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.tags-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tags-toggle-btn {
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.tags-chevron {
  font-size: 11px;
  color: var(--color-text-muted);
  transition: transform 0.15s;
}

.tags-chevron.collapsed {
  transform: rotate(-90deg);
}

.clear-tag-btn {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.clear-tag-btn:hover {
  text-decoration: underline;
}

.tags-loading,
.tags-empty {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tags-panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-search-input {
  width: 100%;
  font-size: 12px;
  padding: 5px 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: 999px;
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

.tag-chip:hover {
  border-color: var(--color-primary);
}

.tag-chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.tag-count {
  color: var(--color-text-muted);
  font-size: 11px;
}

.tree-content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  transition: background 0.15s;
}

.tree-content.root-drag-over {
  background: var(--color-primary-light);
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
