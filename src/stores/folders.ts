import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as foldersApi from '@/api/folders'
import * as pagesApi from '@/api/pages'
import type { FolderTreeNode } from '@/types'

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
    } finally {
      loading.value = false
    }
  }

  async function createFolder(name: string, parentId?: string) {
    await foldersApi.createFolder(name, parentId)
    await fetchTree(true)
  }

  async function renameFolder(id: string, name: string) {
    await foldersApi.renameFolder(id, name)
    await fetchTree(true)
  }

  async function moveFolder(id: string, parentId: string | null) {
    await foldersApi.moveFolder(id, parentId)
    await fetchTree(true)
  }

  async function deleteFolder(id: string) {
    await foldersApi.deleteFolder(id)
    await fetchTree(true)
  }

  async function movePage(slug: string, folderId: string | null) {
    await pagesApi.updatePage(slug, { folderId })
    await fetchTree(true)
  }

  return {
    tree, loading, expandedFolders,
    toggleFolder, isExpanded, fetchTree,
    createFolder, renameFolder, moveFolder, deleteFolder, movePage
  }
})
