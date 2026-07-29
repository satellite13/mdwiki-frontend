import { describe, expect, it } from 'vitest'
import { buildFindHighlightHtml, findMatchIndices, nextMatchIndex, prevMatchIndex } from './editorFind'

describe('findMatchIndices', () => {
  it('finds all case-insensitive occurrences', () => {
    expect(findMatchIndices('Foo bar foo', 'foo')).toEqual([0, 8])
  })

  it('returns empty for blank query', () => {
    expect(findMatchIndices('text', '   ')).toEqual([])
  })
})

describe('nextMatchIndex', () => {
  const matches = [0, 10, 20]

  it('wraps to first match after the last', () => {
    expect(nextMatchIndex(matches, 25, 2)).toBe(0)
  })

  it('moves from current match at cursor', () => {
    expect(nextMatchIndex(matches, 10, 1)).toBe(2)
  })
})

describe('prevMatchIndex', () => {
  const matches = [0, 10, 20]

  it('wraps to last match before the first', () => {
    expect(prevMatchIndex(matches, 0, 0)).toBe(2)
  })
})

describe('buildFindHighlightHtml', () => {
  it('wraps matches and marks the active one', () => {
    const html = buildFindHighlightHtml('Foo bar foo', [0, 8], 3, 1)
    expect(html).toBe(
      '<mark class="find-match">Foo</mark> bar <mark class="find-match find-match-active">foo</mark>'
    )
  })

  it('escapes HTML outside and inside matches', () => {
    const html = buildFindHighlightHtml('<tag>', [1], 3, 0)
    expect(html).toBe('&lt;<mark class="find-match find-match-active">tag</mark>&gt;')
  })

  it('returns escaped text when there are no matches', () => {
    expect(buildFindHighlightHtml('a < b', [], 1, -1)).toBe('a &lt; b')
  })
})
