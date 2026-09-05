import client from './client'
import type { OrphanDefinition, OrphanPage, Page, UnlinkedMention } from '@/types'

export const getUnlinkedMentions = (slug: string, signal?: AbortSignal) =>
  client.get<UnlinkedMention[]>(`/pages/${encodeURIComponent(slug)}/unlinked-mentions`, { signal })

export const linkUnlinkedMention = (
  targetSlug: string,
  payload: Pick<UnlinkedMention, 'sourceSlug' | 'startOffset' | 'endOffset' | 'expectedUpdatedAt'>
) => client.post<Page>(`/pages/${encodeURIComponent(targetSlug)}/unlinked-mentions/link`, payload)

export const getOrphans = (definition: OrphanDefinition, signal?: AbortSignal) =>
  client.get<OrphanPage[]>('/pages/orphans', { params: { definition }, signal })
