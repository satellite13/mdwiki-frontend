import axios from 'axios'
import client from './client'
import type { Page, PageListItem, Backlink } from '@/types'
import { stripFolderPrefix } from '@/utils/folderId'
import { invalidateWikilinkPageListCache } from '@/utils/wikilinkPageListCache'
import { clearWikilinkPreviewPages } from '@/utils/wikilinkResolve'

export function listPages() { return client.get<PageListItem[]>('/pages') }
export function getPage(slug: string) { return client.get<Page>(`/pages/${slug}`) }
export function getBacklinks(slug: string) { return client.get<Backlink[]>(`/pages/${slug}/backlinks`) }
export async function createPage(slug: string, title: string, contentMd: string, folderId?: string) {
  const cleanFolderId = folderId ? stripFolderPrefix(folderId) : undefined
  const res = await client.post<Page>('/pages', { slug, title, contentMd, folderId: cleanFolderId })
  invalidateWikilinkPageListCache()
  clearWikilinkPreviewPages()
  return res
}
export async function updatePage(slug: string, data: { title?: string; contentMd?: string; folderId?: string | null; clearFolder?: boolean }) {
  const folderId = data.folderId
  const payload =
    folderId != null ? { ...data, folderId: stripFolderPrefix(folderId) } : data
  const res = await client.put<Page>(`/pages/${slug}`, payload)
  invalidateWikilinkPageListCache()
  clearWikilinkPreviewPages()
  return res
}
/** 404 считаем успехом: страницы в API уже нет (идемпотентное удаление). */
export async function deletePage(slug: string) {
  try {
    const res = await client.delete(`/pages/${slug}`)
    invalidateWikilinkPageListCache()
    clearWikilinkPreviewPages()
    return res
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      invalidateWikilinkPageListCache()
      clearWikilinkPreviewPages()
      return e.response
    }
    throw e
  }
}
