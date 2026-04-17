import client from './client'
import { invalidateWikilinkPageListCache } from '@/utils/wikilinkPageListCache'
import { clearWikilinkPreviewPages } from '@/utils/wikilinkResolve'

export interface WikiSyncResult {
  added: number
  updated: number
  removed: number
}

/** Полная синхронизация markdown из wiki-content ↔ БД (только ADMIN на API). */
export async function postWikiFullSync() {
  const res = await client.post<WikiSyncResult>('/sync')
  invalidateWikilinkPageListCache()
  clearWikilinkPreviewPages()
  return res
}
