import { useRouter } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { useDialogStore } from '@/stores/dialog'
import * as pagesApi from '@/api/pages'
import { normalizePageSlug } from '@/utils/pageSlug'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import type { FolderTreeNode } from '@/types'

export interface UseTreeActionsOptions {
  getActiveSlug: () => string | null
}

/**
 * Действия над деревом: создание страницы/папки, переименование, удаление.
 * Использует dialog store для UI-взаимодействия и folder store для API.
 */
export function useTreeActions(options: UseTreeActionsOptions) {
  const router = useRouter()
  const folderStore = useFolderStore()
  const dialog = useDialogStore()

  async function createNewPage(folderId?: string) {
    const titleRaw = await dialog.prompt(t.tree.pageNamePrompt)
    if (titleRaw === null || !titleRaw.trim()) return
    const title = titleRaw.trim()
    const slug = normalizePageSlug(title)
    if (!slug) return
    await pagesApi.createPage(slug, title, '', folderId || undefined)
    router.push(`/page/${slug}`)
  }

  async function createNewFolder(parentId?: string) {
    const nameRaw = await dialog.prompt(t.tree.folderNamePrompt)
    if (nameRaw === null || !nameRaw.trim()) return
    try {
      await folderStore.createFolder(nameRaw.trim(), parentId || undefined)
    } catch (error) {
      await dialog.alert(getApiErrorMessage(error, t.errors.createFolderFailed))
    }
  }

  async function renameFolderNode(node: FolderTreeNode) {
    const newNameRaw = await dialog.prompt(t.tree.newNamePrompt, node.name)
    if (newNameRaw === null) return
    const newName = newNameRaw.trim()
    if (!newName || newName === node.name) return
    try {
      await folderStore.renameFolder(node.id, newName)
    } catch {
      await dialog.alert(t.errors.renameFolderFailed)
    }
  }

  async function deleteNode(node: FolderTreeNode) {
    const ok = await dialog.confirm(t.tree.confirmDelete(node.name), {
      danger: true,
      confirmLabel: t.tree.delete
    })
    if (!ok) return
    try {
      if (node.type === 'folder') {
        await folderStore.deleteFolder(node.id)
      } else if (node.slug) {
        await pagesApi.deletePage(node.slug)
        if (options.getActiveSlug() === node.slug) router.push('/')
        await folderStore.fetchTree(true)
      }
    } catch (e) {
      console.error('Delete node failed:', e)
      await dialog.alert(
        node.type === 'folder' ? t.errors.deleteFolderFailed : t.errors.deletePageFailed
      )
    }
  }

  return {
    createNewPage,
    createNewFolder,
    renameFolderNode,
    deleteNode
  }
}
