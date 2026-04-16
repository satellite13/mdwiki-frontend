import client from './client'
import type { SearchResult } from '@/types'
export function searchPages(query: string) { return client.get<SearchResult[]>('/search', { params: { q: query } }) }
