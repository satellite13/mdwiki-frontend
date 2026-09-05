import client from './client'
import type { SearchResult, RagSearchResult, AnswerResponse } from '@/types'

export function searchPages(query: string, tags: string[] = []) {
  return client.get<SearchResult[]>('/search', { params: { q: query, tags: tags.join(',') || undefined } })
}

export function answerQuestion(question: string, topK = 5, signal?: AbortSignal) {
  return client.post<AnswerResponse>('/search/answer', { question, topK }, { signal })
}

export function searchPagesRag(query: string, topK?: number, tags: string[] = []) {
  return client.get<RagSearchResult[]>('/search/rag', { params: { q: query, topK, tags: tags.join(',') || undefined } })
}
