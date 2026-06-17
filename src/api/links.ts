import client from './client'
import type { BrokenLink, RewriteBrokenLinksResult } from '@/types'
import { invalidatePageIndex } from '@/services/pageIndex'

export function listBrokenLinks() {
  return client.get<BrokenLink[]>('/links/broken')
}

export async function rewriteBrokenLinks(payload: {
  fromTarget: string
  toSlug: string
  sourceSlug?: string
}) {
  const res = await client.post<RewriteBrokenLinksResult>('/links/rewrite', payload)
  invalidatePageIndex()
  return res
}
