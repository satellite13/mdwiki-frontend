import { describe, expect, it, vi } from 'vitest'
import type * as pageIndex from '@/services/pageIndex'
import type * as sanitizeHtmlModule from '@/utils/sanitizeHtml'

vi.mock('@/services/pageIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof pageIndex>()
  return {
    ...actual,
    isMissingPageReference: vi.fn(() => false)
  }
})

vi.mock('@/utils/sanitizeHtml', async (importOriginal) => {
  const actual = await importOriginal<typeof sanitizeHtmlModule>()
  return {
    ...actual,
    sanitizeHtml: vi.fn(actual.sanitizeHtml)
  }
})

import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { renderAnnotationComment } from './renderAnnotationComment'

const mockedSanitize = vi.mocked(sanitizeHtml)

describe('renderAnnotationComment', () => {
  it('renders wikilinks as links without raw [[…]] syntax', async () => {
    const html = await renderAnnotationComment('Идея развита в статью: [[foo|Bar]]')

    expect(html).toContain('class="wikilink"')
    expect(html).toContain('href="/page/foo"')
    expect(html).toContain('>Bar</a>')
    expect(html).not.toContain('[[')
    expect(html.startsWith('<p>')).toBe(false)
  })

  it('sanitizes script tags from the comment', async () => {
    const html = await renderAnnotationComment('<script>alert(1)</script>')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })

  it('falls back to escaped text when rendering fails', async () => {
    mockedSanitize.mockImplementationOnce(() => {
      throw new Error('sanitize failed')
    })

    const html = await renderAnnotationComment('<b>текст</b>')

    expect(html).toBe('&lt;b&gt;текст&lt;/b&gt;')
  })
})
