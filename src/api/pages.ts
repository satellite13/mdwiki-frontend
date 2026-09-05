import client from './client'
import type { Page, PageListItem, Backlink, ImportMdPagesResponse, PageSectionMapResponse, RevisionSummary, RevisionSnapshot } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'
import { isApiErrorWithStatus } from '@/utils/apiError'
import { invalidatePageIndex } from '@/services/pageIndex'

export function listPages(params?: { page?: number; size?: number }) {
  return client.get<PageListItem[]>('/pages', { params })
}

export function getPage(slug: string) {
  return client.get<Page>(`/pages/${slug}`)
}

export function getBacklinks(slug: string) {
  return client.get<Backlink[]>(`/pages/${slug}/backlinks`)
}

export function getPageSections(slug: string) {
  return client.get<PageSectionMapResponse>(`/pages/${slug}/sections`)
}

export function listRevisions(slug: string, params?: { limit?: number; before?: number }) {
  return client.get<RevisionSummary[]>(`/pages/${encodeURIComponent(slug)}/revisions`, { params })
}

export function getRevision(slug: string, revisionNo: number) {
  return client.get<RevisionSnapshot>(`/pages/${encodeURIComponent(slug)}/revisions/${revisionNo}`)
}

export async function restoreRevision(slug: string, revisionNo: number, expectedUpdatedAt: string, restoreTitle = false) {
  const res = await client.post<Page>(`/pages/${encodeURIComponent(slug)}/restore`, {
    revisionNo, expectedUpdatedAt, restoreTitle,
  })
  invalidatePageIndex()
  return res
}

export function materializeStableLink(slug: string, sectionKey: string, expectedUpdatedAt: string) {
  return client.post(`/pages/${encodeURIComponent(slug)}/sections/stable-link`, { sectionKey, expectedUpdatedAt })
}

export async function createPage(slug: string, title: string, contentMd: string, folderId?: string) {
  const cleanFolderId = folderId ? stripFolderPrefix(folderId) : undefined
  const res = await client.post<Page>('/pages', { slug, title, contentMd, folderId: cleanFolderId })
  invalidatePageIndex()
  return res
}

export async function importPages(
  files: File[],
  options?: { folderId?: string; overwrite?: boolean }
) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  if (options?.folderId) {
    formData.append('folderId', stripFolderPrefix(options.folderId))
  }
  if (options?.overwrite) {
    formData.append('overwrite', 'true')
  }
  const res = await client.post<ImportMdPagesResponse>('/pages/import', formData, {
    transformRequest: [
      (data, headers) => {
        if (data instanceof FormData) {
          delete (headers as Record<string, unknown>)['Content-Type']
        }
        return data
      }
    ]
  })
  invalidatePageIndex()
  return res
}

export async function updatePage(
  slug: string,
  data: {
    slug?: string
    title?: string
    contentMd?: string
    folderId?: string | null
    clearFolder?: boolean
    expectedUpdatedAt?: string
  }
) {
  const folderId = data.folderId
  const payload = folderId != null ? { ...data, folderId: stripFolderPrefix(folderId) } : data
  const res = await client.put<Page>(`/pages/${slug}`, payload)
  invalidatePageIndex()
  return res
}

export function listDeletedPages() {
  return client.get<PageListItem[]>('/pages/deleted')
}

export async function restorePage(slug: string) {
  const res = await client.post<Page>(`/pages/${slug}/restore`)
  invalidatePageIndex()
  return res
}

/** Idempotent delete: 404 is treated as success — the page is already gone. */
export async function deletePage(slug: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
  try {
    await client.delete(`/pages/${slug}`, { params: { mode: mode.toUpperCase() } })
  } catch (e) {
    if (!isApiErrorWithStatus(e, 404)) throw e
  } finally {
    invalidatePageIndex()
  }
}
