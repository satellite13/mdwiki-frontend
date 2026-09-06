import client from './client'
import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'

export type SavedSearchInput = {
  name: string
  queryText: string
  mode: SavedSearchMode
  tags: string[]
  minScore: number | null
  sort: SavedSearchSort
  expectedVersion?: number
}

export const listSavedSearches = () => client.get<SavedSearch[]>('/me/saved-searches')
export const getSavedSearch = (id: string) => client.get<SavedSearch>(`/me/saved-searches/${id}`)
export const createSavedSearch = (input: SavedSearchInput) => client.post<SavedSearch>('/me/saved-searches', input)
export const updateSavedSearch = (id: string, input: SavedSearchInput) => client.put<SavedSearch>(`/me/saved-searches/${id}`, input)
export const deleteSavedSearch = (id: string) => client.delete(`/me/saved-searches/${id}`)
