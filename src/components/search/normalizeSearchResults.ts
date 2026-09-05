import type { RagSearchResult, SearchResult } from '@/types'

export type SearchSource = 'text' | 'semantic'

export interface NormalizedSearchResult {
  slug: string
  title: string
  snippet: string
  sectionHeading: string | null
  sectionKey: string | null
  score: number | null
  tags: string[]
  sources: SearchSource[]
}

export function normalizeSearchResults(
  textResults: SearchResult[],
  semanticResults: RagSearchResult[]
): NormalizedSearchResult[] {
  const semanticBySlug = new Map<string, RagSearchResult>()
  for (const result of semanticResults) {
    if (!semanticBySlug.has(result.pageSlug)) semanticBySlug.set(result.pageSlug, result)
  }
  const merged = textResults.map<NormalizedSearchResult>((textResult) => {
    const semantic = semanticBySlug.get(textResult.slug)
    if (!semantic) {
      return {
        slug: textResult.slug,
        title: textResult.title,
        snippet: textResult.snippet,
        sectionHeading: null,
        sectionKey: null,
        score: null,
        tags: [],
        sources: ['text']
      }
    }
    semanticBySlug.delete(textResult.slug)
    return fromSemantic(semantic, ['text', 'semantic'])
  })

  for (const semantic of semanticResults) {
    if (semanticBySlug.has(semantic.pageSlug)) {
      merged.push(fromSemantic(semantic, ['semantic']))
      semanticBySlug.delete(semantic.pageSlug)
    }
  }
  return merged
}

function fromSemantic(
  result: RagSearchResult,
  sources: SearchSource[]
): NormalizedSearchResult {
  return {
    slug: result.pageSlug,
    title: result.pageTitle,
    snippet: result.snippet,
    sectionHeading: result.sectionHeading,
    sectionKey: result.sectionKey ?? null,
    score: result.score,
    tags: result.tags,
    sources
  }
}
