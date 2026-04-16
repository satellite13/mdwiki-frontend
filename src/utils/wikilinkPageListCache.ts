import type { PageListItem } from '@/types'

let pagesCache: PageListItem[] | null = null
let pagesFetchedAt = 0

export const CACHE_TTL_MS = 30_000

/** Сброс кэша списка страниц (после создания/удаления и т.п.). */
export function invalidateWikilinkPageListCache(): void {
  pagesCache = null
}

export function readWikilinkPagesCache(now: number): PageListItem[] | null {
  if (pagesCache && now - pagesFetchedAt < CACHE_TTL_MS) return pagesCache
  return null
}

export function writeWikilinkPagesCache(data: PageListItem[], now: number): void {
  pagesCache = data
  pagesFetchedAt = now
}
