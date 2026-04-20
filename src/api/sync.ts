import client from './client'
import { invalidatePageIndex } from '@/services/pageIndex'

interface WikiSyncResult {
  added: number
  updated: number
  removed: number
}

/** Полная синхронизация markdown из wiki-content ↔ БД (только ADMIN на API). */
export async function postWikiFullSync() {
  const res = await client.post<WikiSyncResult>('/sync')
  invalidatePageIndex()
  return res
}
