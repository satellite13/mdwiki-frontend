import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'

export type SearchDefinition = {
  queryText: string
  mode: SavedSearchMode
  tags: string[]
  minScore: number | null
  sort: SavedSearchSort
}

export function normalizeSearchDefinition(definition: SearchDefinition): SearchDefinition {
  return {
    queryText: definition.queryText.trim(),
    mode: definition.mode,
    tags: [...new Set(definition.tags.map(tag => tag.trim()).filter(Boolean))].sort(),
    minScore: definition.minScore && definition.minScore > 0 ? definition.minScore : null,
    sort: definition.sort,
  }
}

export function savedSearchQuery(saved: SavedSearch): Record<string, string> {
  const normalized = normalizeSearchDefinition(saved)
  return {
    saved: saved.id,
    q: normalized.queryText,
    mode: normalized.mode.toLowerCase(),
    tags: normalized.tags.join(','),
    minScore: normalized.minScore == null ? '' : String(normalized.minScore),
    sort: normalized.sort.toLowerCase(),
  }
}

export function isSavedSearchModified(saved: SavedSearch, current: SearchDefinition): boolean {
  const baseline = normalizeSearchDefinition(saved)
  const normalized = normalizeSearchDefinition(current)
  return baseline.queryText !== normalized.queryText ||
    baseline.mode !== normalized.mode ||
    baseline.tags.join('\u0000') !== normalized.tags.join('\u0000') ||
    baseline.minScore !== normalized.minScore ||
    baseline.sort !== normalized.sort
}
