import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'

export type SearchDefinition = {
  queryText: string
  mode: SavedSearchMode
  tags: string[]
  minScore: number | null
  sort: SavedSearchSort
}

export function savedSearchQuery(saved: SavedSearch): Record<string, string> {
  return {
    saved: saved.id,
    q: saved.queryText,
    mode: saved.mode.toLowerCase(),
    tags: saved.tags.join(','),
    minScore: saved.minScore == null ? '' : String(saved.minScore),
    sort: saved.sort.toLowerCase(),
  }
}

export function isSavedSearchModified(saved: SavedSearch, current: SearchDefinition): boolean {
  return saved.queryText !== current.queryText ||
    saved.mode !== current.mode ||
    saved.tags.join('\u0000') !== current.tags.join('\u0000') ||
    saved.minScore !== current.minScore ||
    saved.sort !== current.sort
}
