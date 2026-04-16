import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as foldersApi from '@/api/folders'
import * as pagesApi from '@/api/pages'
import type { FolderTreeNode } from '@/types'

/** Backend returns folder IDs as "folder-<uuid>" in tree; API expects raw UUID */
function stripFolderPrefix(id: string): string {
  return id.startsWith('folder-') ? id.slice(7) : id
}

export const useFolderStore = defineStore('folders', () => {
  const tree = ref<FolderTreeNode[]>([])
  const loading = ref(false)
  const expandedFolders = ref<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('expandedFolders') || '[]')
  ))

  function saveExpanded() {
    localStorage.setItem('expandedFolders', JSON.stringify([...expandedFolders.value]))
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
    try {
      const cleanId = stripFolderPrefix(id)
      const cleanParentId = parentId ? stripFolderPrefix(parentId) : null
      await foldersApi.moveFolder(cleanId, cleanParentId)
      await fetchTree(true)
    } catch (e) {
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

  async function movePage(slug: string, folderId: string | null) {
    try {
      const cleanFolderId = folderId ? stripFolderPrefix(folderId) : null
      if (cleanFolderId) {
        await pagesApi.updatePage(slug, { folderId: cleanFolderId })
      } else {
        await pagesApi.updatePage(slug, { folderId: null, clearFolder: true })
      }
      await fetchTree(true)
    } catch (e) {
      console.error('Failed to move page:', e)
      throw e
    }
  }

  return {
    tree, loading, expandedFolders,
    toggleFolder, isExpanded, fetchTree,
    createFolder, renameFolder, moveFolder, deleteFolder, movePage
  }
})
