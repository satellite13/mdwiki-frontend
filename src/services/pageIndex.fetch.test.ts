import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageListItem } from '@/types'

const mockListPages = vi.fn()

vi.mock('@/api/pages', () => ({
  listPages: (...args: unknown[]) => mockListPages(...args),
}))

function page(id: string): PageListItem {
  return {
    id,
    slug: `page-${id}`,
    title: `Page ${id}`,
    tags: [],
    folderId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('getPages pagination', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockListPages.mockReset()
    const { invalidatePageIndex } = await import('./pageIndex')
    invalidatePageIndex()
  })

  it('loads all pages across multiple requests', async () => {
    const batch1 = Array.from({ length: 500 }, (_, i) => page(String(i)))
    const batch2 = [page('500'), page('501')]
    mockListPages
      .mockResolvedValueOnce({ data: batch1, headers: { 'x-total-count': '502' } })
      .mockResolvedValueOnce({ data: batch2, headers: { 'x-total-count': '502' } })

    const { getPages } = await import('./pageIndex')
    const pages = await getPages({ force: true })
    expect(pages).toHaveLength(502)
    expect(mockListPages).toHaveBeenCalledTimes(2)
  })

  it('stops when a short page is returned without total header', async () => {
    mockListPages.mockResolvedValueOnce({ data: [page('1')], headers: {} })

    const { getPages } = await import('./pageIndex')
    const pages = await getPages({ force: true })
    expect(pages).toHaveLength(1)
    expect(mockListPages).toHaveBeenCalledTimes(1)
  })
})
