import { useRouter } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import { useDialogStore } from '@/stores/dialog'
import { useEditorUiStore } from '@/stores/editorUi'
import * as pagesApi from '@/api/pages'
import { normalizePageSlug } from '@/utils/pageSlug'
import { getApiErrorMessage } from '@/utils/apiError'
import { countPagesInFolder, folderContainsPageSlug } from '@/utils/folderTree'
import { useI18n } from 'vue-i18n'
import type { FolderTreeNode, ImportMdPagesResponse } from '@/types'
import type { FolderDeletePageAction } from '@/api/folders'
import { pickFiles } from '@/utils/pickFiles'

function formatImportSummary(
  result: ImportMdPagesResponse,
  translate: (key: string, values?: Record<string, unknown>) => string
): string {
  const lines = [
    translate('tree.importSummary', {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors
    })
  ]
  const problems = result.results.filter((item) => item.status === 'skipped' || item.status === 'error')
  for (const item of problems.slice(0, 8)) {
    const detail = item.message ? `: ${item.message}` : ''
    lines.push(`• ${item.filename} (${item.status})${detail}`)
  }
  if (problems.length > 8) {
    lines.push(translate('tree.importSummaryMore', { count: problems.length - 8 }))
  }
  return lines.join('\n')
}

export interface UseTreeActionsOptions {
  getActiveSlug: () => string | null
}

/**
 * Действия над деревом: создание страницы/папки, переименование, удаление.
 * Использует dialog store для UI-взаимодействия и folder store для API.
 */
export function useTreeActions(options: UseTreeActionsOptions) {
  const { t } = useI18n()
  const router = useRouter()
  const folderStore = useFolderStore()
  const dialog = useDialogStore()
  const editorUi = useEditorUiStore()

  async function createNewPage(folderId?: string) {
    const titleRaw = await dialog.prompt(t('tree.pageNamePrompt'))
    if (titleRaw === null || !titleRaw.trim()) return
    const title = titleRaw.trim()
    const slug = normalizePageSlug(title)
    if (!slug) return
    await pagesApi.createPage(slug, title, '', folderId || undefined)
    editorUi.setReadingMode(false)
    router.push(`/page/${slug}`)
  }

  async function createNewFolder(parentId?: string) {
    const nameRaw = await dialog.prompt(t('tree.folderNamePrompt'))
    if (nameRaw === null || !nameRaw.trim()) return
    try {
      await folderStore.createFolder(nameRaw.trim(), parentId || undefined)
    } catch (error) {
      await dialog.alert(getApiErrorMessage(error, t('errors.createFolderFailed')))
    }
  }

  async function importMdPages(folderId?: string) {
    const files = await pickFiles({ accept: '.md,.markdown,text/markdown', multiple: true })
    if (!files.length) return

    const mode = await dialog.choice(
      t('tree.importOverwritePrompt', { count: files.length }),
      [
        {
          value: 'skip',
          label: t('tree.importSkipExistingLabel'),
          description: t('tree.importSkipExistingHint')
        },
        {
          value: 'overwrite',
          label: t('tree.importOverwriteLabel'),
          description: t('tree.importOverwriteHint'),
          danger: true
        }
      ],
      { title: t('tree.importMd') }
    )
    if (!mode) return

    try {
      const { data } = await pagesApi.importPages(files, {
        folderId: folderId || undefined,
        overwrite: mode === 'overwrite'
      })
      await folderStore.fetchTree(true)
      await dialog.alert(formatImportSummary(data, t))
      const createdOnly = data.results.filter((item) => item.status === 'created' && item.slug)
      if (createdOnly.length === 1 && createdOnly[0].slug) {
        editorUi.setReadingMode(false)
        router.push(`/page/${createdOnly[0].slug}`)
      }
    } catch (error) {
      await dialog.alert(getApiErrorMessage(error, t('errors.importMdFailed')))
    }
  }

  async function renameFolderNode(node: FolderTreeNode) {
    const newNameRaw = await dialog.prompt(t('tree.newNamePrompt'), node.name)
    if (newNameRaw === null) return
    const newName = newNameRaw.trim()
    if (!newName || newName === node.name) return
    try {
      await folderStore.renameFolder(node.id, newName)
    } catch {
      await dialog.alert(t('errors.renameFolderFailed'))
    }
  }

  async function deleteNode(node: FolderTreeNode) {
    try {
      if (node.type === 'folder') {
        const pageCount = countPagesInFolder(node)
        let pageAction: FolderDeletePageAction = 'delete'

        if (pageCount > 0) {
          const choice = await dialog.choice(
            t('tree.chooseFolderDeleteMode', { name: node.name, pageCount }),
            [
              {
                value: 'delete',
                label: t('tree.deletePagesWithFolderLabel'),
                description: t('tree.deletePagesWithFolderHint'),
                danger: true
              },
              {
                value: 'move_to_root',
                label: t('tree.movePagesToRootLabel'),
                description: t('tree.movePagesToRootHint')
              }
            ],
            { title: t('tree.deleteFolder') }
          )
          if (!choice) return
          pageAction = choice === 'move_to_root' ? 'move_to_root' : 'delete'
        } else {
          const ok = await dialog.confirm(t('tree.confirmDelete', { name: node.name }), {
            danger: true,
            confirmLabel: t('tree.delete')
          })
          if (!ok) return
        }

        await folderStore.deleteFolder(node.id, pageAction)
        const activeSlug = options.getActiveSlug()
        if (activeSlug && pageAction === 'delete' && folderContainsPageSlug(node, activeSlug)) {
          router.push('/')
        }
      } else if (node.slug) {
        const mode = await dialog.choice(
          t('tree.chooseDeleteMode', { name: node.name }),
          [
            {
              value: 'soft',
              label: t('tree.softDeleteLabel'),
              description: t('tree.softDeleteHint')
            },
            {
              value: 'hard',
              label: t('tree.hardDeleteLabel'),
              description: t('tree.hardDeleteHint'),
              danger: true
            }
          ],
          { title: t('tree.deletePage') }
        )
        if (!mode) return
        await pagesApi.deletePage(node.slug, mode === 'hard' ? 'hard' : 'soft')
        if (options.getActiveSlug() === node.slug) router.push('/')
        await folderStore.fetchTree(true)
      }
    } catch (e) {
      console.error('Delete node failed:', e)
      await dialog.alert(
        node.type === 'folder'
          ? getApiErrorMessage(e, t('errors.deleteFolderFailed'))
          : getApiErrorMessage(e, t('errors.deletePageFailed'))
      )
    }
  }

  return {
    createNewPage,
    createNewFolder,
    importMdPages,
    renameFolderNode,
    deleteNode
  }
}
