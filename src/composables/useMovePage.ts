import * as pagesApi from '@/api/pages'
import { useFolderStore } from '@/stores/folders'
import { stripFolderPrefix } from '@/utils/folderId'
import { dndLog } from '@/utils/dndDebug'

/**
 * Перенос страницы в другую папку (или в корень, если `folderId === null`).
 * Вынесено из `stores/folders.ts`, потому что операция принадлежит домену
 * страниц, а не папок; folders store после переноса инвалидируется явно.
 */
export function useMovePage() {
  const folderStore = useFolderStore()

  async function movePage(slug: string, folderId: string | null): Promise<void> {
    dndLog('movePage (start)', { slug, folderId })
    try {
      const cleanFolderId = folderId ? stripFolderPrefix(folderId) : null
      if (cleanFolderId) {
        await pagesApi.updatePage(slug, { folderId: cleanFolderId })
      } else {
        await pagesApi.updatePage(slug, { folderId: null, clearFolder: true })
      }
      await folderStore.fetchTree(true)
      dndLog('movePage (ok)', { slug, cleanFolderId })
    } catch (e) {
      dndLog('movePage (error)', { slug, message: e instanceof Error ? e.message : String(e) })
      console.error('Failed to move page:', e)
      throw e
    }
  }

  return { movePage }
}
