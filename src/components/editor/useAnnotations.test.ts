import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useAnnotations } from './useAnnotations'

const listAnnotations = vi.fn()
vi.mock('@/api/annotations', () => ({
  listAnnotations: (...args: unknown[]) => listAnnotations(...args)
}))

const annotation = (id: string, pageId: string) => ({
  id,
  pageId,
  highlightedText: id,
  anchorContext: id,
  comment: null,
  rangeStart: null,
  rangeEnd: null,
  color: null,
  createdBy: 'editor',
  createdAt: '2026-09-05T10:00:00Z',
  updatedAt: '2026-09-05T10:00:00Z'
})

describe('useAnnotations page isolation', () => {
  it('clears annotations on page change and ignores the previous page response', async () => {
    let slug = 'page-a'
    let resolveA!: (value: unknown) => void
    let resolveB!: (value: unknown) => void
    listAnnotations.mockImplementation((requestedSlug: string) => new Promise((resolve) => {
      if (requestedSlug === 'page-a') resolveA = resolve
      else resolveB = resolve
    }))
    const annotations = useAnnotations({
      getPreviewContentElement: () => null,
      getEditorMode: () => 'reading',
      getPageSlug: () => slug
    })

    annotations.handlePageChange()
    slug = 'page-b'
    annotations.handlePageChange()
    expect(annotations.annotations.value).toEqual([])
    expect(listAnnotations).toHaveBeenNthCalledWith(1, 'page-a')
    expect(listAnnotations).toHaveBeenNthCalledWith(2, 'page-b')

    resolveB({ data: [annotation('b', 'page-b')] })
    await flushPromises()
    expect(annotations.annotations.value.map((item) => item.id)).toEqual(['b'])

    resolveA({ data: [annotation('a', 'page-a')] })
    await flushPromises()
    expect(annotations.annotations.value.map((item) => item.id)).toEqual(['b'])
  })
})
