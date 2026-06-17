import { describe, expect, it } from 'vitest'
import type { PageListItem } from '@/types'
import { pageMatchesWikilinkQuery } from './pageIndex'

const sample: PageListItem = {
  id: '1',
  slug: 'глава-17-техники-рассуждения',
  title: 'Глава 17: Техники рассуждения',
  tags: [],
  folderId: null,
  updatedAt: '2026-01-01T00:00:00Z'
}

describe('pageMatchesWikilinkQuery', () => {
  it('matches by title substring', () => {
    expect(pageMatchesWikilinkQuery(sample, 'Техники рассуждения')).toBe(true)
  })

  it('matches by normalized key when query uses spaces and colon', () => {
    expect(pageMatchesWikilinkQuery(sample, 'Глава 17: Техники')).toBe(true)
    expect(pageMatchesWikilinkQuery(sample, 'глава 17')).toBe(true)
  })

  it('matches by slug fragment', () => {
    expect(pageMatchesWikilinkQuery(sample, 'техники-рассуждения')).toBe(true)
  })

  it('rejects unrelated queries', () => {
    expect(pageMatchesWikilinkQuery(sample, 'Глава 18')).toBe(false)
  })
})
