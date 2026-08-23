import { describe, expect, it } from 'vitest'
import { groupAnnotationsByText } from './groupAnnotations'
import type { Annotation } from '@/types'

function makeAnnotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    pageId: 'p1',
    highlightedText: 'hello',
    anchorContext: '',
    comment: null,
    rangeStart: null,
    rangeEnd: null,
    color: null,
    createdBy: 'user',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

describe('groupAnnotationsByText', () => {
  it('groups annotations with the same highlightedText into one group', () => {
    const result = groupAnnotationsByText([
      makeAnnotation({ id: '1', highlightedText: 'same text' }),
      makeAnnotation({ id: '2', highlightedText: 'other text' }),
      makeAnnotation({ id: '3', highlightedText: 'same text' })
    ])
    expect(result).toEqual([
      { text: 'same text', ids: ['1', '3'] },
      { text: 'other text', ids: ['2'] }
    ])
  })

  it('keeps groups in first-seen order for different texts', () => {
    const result = groupAnnotationsByText([
      makeAnnotation({ id: '1', highlightedText: 'b' }),
      makeAnnotation({ id: '2', highlightedText: 'a' }),
      makeAnnotation({ id: '3', highlightedText: 'b' }),
      makeAnnotation({ id: '4', highlightedText: 'c' })
    ])
    expect(result).toEqual([
      { text: 'b', ids: ['1', '3'] },
      { text: 'a', ids: ['2'] },
      { text: 'c', ids: ['4'] }
    ])
  })

  it('skips annotations with empty highlightedText', () => {
    const result = groupAnnotationsByText([
      makeAnnotation({ id: '1', highlightedText: '' }),
      makeAnnotation({ id: '2', highlightedText: 'real text' }),
      makeAnnotation({ id: '3', highlightedText: '' })
    ])
    expect(result).toEqual([{ text: 'real text', ids: ['2'] }])
  })

  it('returns an empty array when there are no annotations', () => {
    expect(groupAnnotationsByText([])).toEqual([])
  })
})
