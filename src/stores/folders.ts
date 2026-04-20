import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as foldersApi from '@/api/folders'
import type { FolderTreeNode } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'
import { dndLog } from '@/utils/dndDebug'
import { readJson, writeJson } from '@/utils/localPreferences'

const EXPANDED_FOLDERS_KEY = 'expandedFolders'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export const useFolderStore = defineStore('folders', () => {
  const tree = ref<FolderTreeNode[]>([])
  /** Инкремент в конце drag (страница/папка) — сброс подсветки drop в WebKit, где dragleave с relatedTarget=null. */
  const treeDragGeneration = ref(0)
  const loading = ref(false)
  const expandedFolders = ref<Set<string>>(
    new Set(readJson<string[]>(EXPANDED_FOLDERS_KEY, [], isStringArray))
  )

  function saveExpanded() {
    writeJson(EXPANDED_FOLDERS_KEY, [...expandedFolders.value])
  }

  function toggleFolder(id: string) {
    if (expandedFolders.value.has(id)) {
      expandedFolders.value.delete(id)
    } else {
      expandedFolders.value.add(id)
    }
    saveExpanded()
  }

  function isExpanded(id: string): boolean {
    return expandedFolders.value.has(id)
  }

  function notifyTreeDragEnd() {
    treeDragGeneration.value++
  }

  async function fetchTree(force = false) {
    if (!force && tree.value.length > 0) return
    loading.value = true
    try {
      const { data } = await foldersApi.getFolderTree()
      tree.value = data
    } catch (e) {
      console.error('Failed to fetch tree:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createFolder(name: string, parentId?: string) {
    try {
      const cleanParentId = parentId ? stripFolderPrefix(parentId) : undefined
      await foldersApi.createFolder(name, cleanParentId)
      await fetchTree(true)
    } catch (e) {
      console.error('Failed to create folder:', e)
      throw e
    }
  }

  async function renameFolder(id: string, name: string) {
    try {
      await foldersApi.renameFolder(stripFolderPrefix(id), name)
      await fetchTree(true)
    } catch (e) {
      console.error('Failed to rename folder:', e)
      throw e
    }
  }

  async function moveFolder(id: string, parentId: string | null) {
    dndLog('store moveFolder (start)', { id, parentId })
    try {
      const cleanId = stripFolderPrefix(id)
      const cleanParentId = parentId ? stripFolderPrefix(parentId) : null
      await foldersApi.moveFolder(cleanId, cleanParentId)
      await fetchTree(true)
      dndLog('store moveFolder (ok)', { cleanId, cleanParentId })
    } catch (e) {
      dndLog('store moveFolder (error)', { message: e instanceof Error ? e.message : String(e) })
      console.error('Failed to move folder:', e)
      throw e
    }
  }

  async function deleteFolder(id: string) {
    try {
      await foldersApi.deleteFolder(stripFolderPrefix(id))
      await fetchTree(true)
    } catch (e) {
      console.error('Failed to delete folder:', e)
      throw e
    }
  }

  return {
    tree,
    treeDragGeneration,
    loading,
    expandedFolders,
    toggleFolder,
    isExpanded,
    fetchTree,
    notifyTreeDragEnd,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder
  }
})
