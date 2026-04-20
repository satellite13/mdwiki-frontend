import axios from 'axios'
import client from './client'
import type { Page, PageListItem, Backlink } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'
import { invalidateWikilinkPageListCache } from '@/utils/wikilinkPageListCache'
import { clearWikilinkPreviewPages } from '@/utils/wikilinkResolve'

function invalidatePageCaches(): void {
  invalidateWikilinkPageListCache()
  clearWikilinkPreviewPages()
}

export function listPages() {
  return client.get<PageListItem[]>('/pages')
}

export function getPage(slug: string) {
  return client.get<Page>(`/pages/${slug}`)
}

export function getBacklinks(slug: string) {
  return client.get<Backlink[]>(`/pages/${slug}/backlinks`)
}

export async function createPage(slug: string, title: string, contentMd: string, folderId?: string) {
  const cleanFolderId = folderId ? stripFolderPrefix(folderId) : undefined
  const res = await client.post<Page>('/pages', { slug, title, contentMd, folderId: cleanFolderId })
  invalidatePageCaches()
  return res
}

export async function updatePage(
  slug: string,
  data: { title?: string; contentMd?: string; folderId?: string | null; clearFolder?: boolean }
) {
  const folderId = data.folderId
  const payload = folderId != null ? { ...data, folderId: stripFolderPrefix(folderId) } : data
  const res = await client.put<Page>(`/pages/${slug}`, payload)
  invalidatePageCaches()
  return res
}

/** Idempotent delete: 404 is treated as success — the page is already gone. */
export async function deletePage(slug: string): Promise<void> {
  try {
    await client.delete(`/pages/${slug}`)
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 404) {
      throw e
    }
  } finally {
    invalidatePageCaches()
  }
}
