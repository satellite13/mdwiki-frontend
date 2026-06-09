import client from './client'
import type { SearchResult, RagSearchResult } from '@/types'

export function searchPages(query: string) {
  return client.get<SearchResult[]>('/search', { params: { q: query } })
}

export function searchPagesRag(query: string, topK?: number) {
  return client.get<RagSearchResult[]>('/search/rag', { params: { q: query, topK } })
}
