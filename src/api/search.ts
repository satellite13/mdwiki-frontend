import client from './client'
import type { SearchResult, RagSearchResult, AnswerResponse } from '@/types'

export function searchPages(query: string) {
  return client.get<SearchResult[]>('/search', { params: { q: query } })
}

export function answerQuestion(question: string, topK = 5, signal?: AbortSignal) {
  return client.post<AnswerResponse>('/search/answer', { question, topK }, { signal })
}

export function searchPagesRag(query: string, topK?: number) {
  return client.get<RagSearchResult[]>('/search/rag', { params: { q: query, topK } })
}
