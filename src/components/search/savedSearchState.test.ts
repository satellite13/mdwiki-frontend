import { describe, expect, it } from 'vitest'
import { isSavedSearchModified, savedSearchQuery } from './savedSearchState'
import type { SavedSearch } from '@/types'

const saved: SavedSearch = {
  id: 's1', name: 'Mine', queryText: 'lambda', mode: 'SEMANTIC',
  tags: ['one', 'два'], minScore: 0.75, sort: 'UPDATED', version: 2,
  createdAt: '', updatedAt: '',
}

describe('savedSearchState', () => {
  it('canonicalizes every filter while retaining saved id', () => {
    expect(savedSearchQuery(saved)).toEqual({
      saved: 's1', q: 'lambda', mode: 'semantic',
      tags: 'one,два', minScore: '0.75', sort: 'updated',
    })
  })

  it('marks only local definition changes modified', () => {
    expect(isSavedSearchModified(saved, {
      queryText: 'lambda', mode: 'SEMANTIC', tags: ['one', 'два'],
      minScore: 0.75, sort: 'UPDATED',
    })).toBe(false)
    expect(isSavedSearchModified(saved, {
      queryText: 'changed', mode: 'SEMANTIC', tags: ['one', 'два'],
      minScore: 0.75, sort: 'UPDATED',
    })).toBe(true)
  })

  it('treats tag order, duplicates, whitespace and zero score as semantic equivalents', () => {
    expect(isSavedSearchModified({ ...saved, tags: ['one', 'two'], minScore: null }, {
      queryText: ' lambda ', mode: 'SEMANTIC', tags: ['two', 'one', 'one', ' '],
      minScore: 0, sort: 'UPDATED',
    })).toBe(false)
  })
})
