import client from './client'
import type { Page, PageListItem, Backlink } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'
import { invalidateWikilinkPageListCache } from '@/utils/wikilinkPageListCache'

export function listPages() { return client.get<PageListItem[]>('/pages') }
export function getPage(slug: string) { return client.get<Page>(`/pages/${slug}`) }
export function getBacklinks(slug: string) { return client.get<Backlink[]>(`/pages/${slug}/backlinks`) }
export async function createPage(slug: string, title: string, contentMd: string, folderId?: string) {
  const cleanFolderId = folderId ? stripFolderPrefix(folderId) : undefined
  const res = await client.post<Page>('/pages', { slug, title, contentMd, folderId: cleanFolderId })
  invalidateWikilinkPageListCache()
  return res
}
export function updatePage(slug: string, data: { title?: string; contentMd?: string; folderId?: string | null; clearFolder?: boolean }) {
  const folderId = data.folderId
  const payload =
    folderId != null ? { ...data, folderId: stripFolderPrefix(folderId) } : data
  return client.put<Page>(`/pages/${slug}`, payload)
}
export async function deletePage(slug: string) {
  const res = await client.delete(`/pages/${slug}`)
  invalidateWikilinkPageListCache()
  return res
}
