import { describe, expect, it } from 'vitest'
import { normalizeSearchResults } from './normalizeSearchResults'
import type { RagSearchResult, SearchResult } from '@/types'

const textResults: SearchResult[] = [
  { pageId: '1', slug: 'alpha', title: 'Alpha text', snippet: 'text alpha' },
  { pageId: '2', slug: 'beta', title: 'Beta', snippet: 'text beta' }
]

const semanticResults: RagSearchResult[] = [
  {
    pageSlug: 'alpha',
    pageTitle: 'Alpha semantic',
    sectionHeading: 'Details',
    sectionKey: 'details-abc',
    snippet: 'semantic alpha',
    score: 0.91,
    tags: ['pkm']
  },
  {
    pageSlug: 'gamma',
    pageTitle: 'Gamma',
    sectionHeading: null,
    snippet: 'semantic gamma',
    score: 0.72,
    tags: []
  }
]

describe('normalizeSearchResults', () => {
  it('merges duplicate slugs and preserves FTS then semantic rank', () => {
    expect(normalizeSearchResults(textResults, semanticResults)).toEqual([
      {
        slug: 'alpha',
        title: 'Alpha semantic',
        snippet: 'semantic alpha',
        sectionHeading: 'Details',
        sectionKey: 'details-abc',
        score: 0.91,
        tags: ['pkm'],
        sources: ['text', 'semantic']
      },
      {
        slug: 'beta',
        title: 'Beta',
        snippet: 'text beta',
        sectionHeading: null,
        sectionKey: null,
        score: null,
        tags: [],
        sources: ['text']
      },
      {
        slug: 'gamma',
        title: 'Gamma',
        snippet: 'semantic gamma',
        sectionHeading: null,
        sectionKey: null,
        score: 0.72,
        tags: [],
        sources: ['semantic']
      }
    ])
  })

  it('does not invent semantic scores or section links for text-only hits', () => {
    const [result] = normalizeSearchResults(textResults.slice(0, 1), [])
    expect(result?.score).toBeNull()
    expect(result?.sectionKey).toBeNull()
    expect(result?.sources).toEqual(['text'])
  })

  it('keeps the highest-ranked semantic hit when a slug occurs more than once', () => {
    const duplicate = {
      ...semanticResults[0]!,
      sectionKey: 'lower-ranked',
      snippet: 'lower ranked',
      score: 0.5
    }
    const [result] = normalizeSearchResults(textResults.slice(0, 1), [
      semanticResults[0]!,
      duplicate
    ])
    expect(result?.sectionKey).toBe('details-abc')
    expect(result?.score).toBe(0.91)
  })
})
