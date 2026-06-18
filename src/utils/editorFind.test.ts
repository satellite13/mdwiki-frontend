import { describe, expect, it } from 'vitest'
import { findMatchIndices, nextMatchIndex, prevMatchIndex } from './editorFind'

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
