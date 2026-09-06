import client from './client'
import { invalidatePageIndex } from '@/services/pageIndex'

interface WikiSyncResult {
  added: number
  updated: number
  removed: number
  attachmentsAdded?: number
}

export interface WikiReindexResult {
  total: number
  reindexed: number
  failed: number
}

/** Полная синхронизация markdown из wiki-content ↔ БД (только ADMIN на API). */
export async function postWikiFullSync() {
  const res = await client.post<WikiSyncResult>('/sync')
  invalidatePageIndex()
  return res
}

export async function postWikiReindex() {
  const res = await client.post<WikiReindexResult>('/sync/reindex')
  invalidatePageIndex()
  return res
}
