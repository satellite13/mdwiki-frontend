import { describe, expect, it, vi } from 'vitest'
import { applySectionMap, focusSection } from './sectionDeepLink'
import type { PageSectionMapResponse } from '@/types'

const sectionMap: PageSectionMapResponse = {
  slug: 'note',
  updatedAt: '2026-09-05T10:00:00Z',
  sections: [
    { key: 'preamble-key', heading: null, headingPath: '', level: 0, length: 4, hash: 'p', includesChildren: false },
    { key: 'same-first', heading: 'Same', headingPath: 'Same', level: 2, length: 5, hash: 'a', includesChildren: false },
    { key: 'same-second', stableId: 'sec_stable', heading: 'Same', headingPath: 'Same', level: 2, length: 5, hash: 'b', includesChildren: false }
  ]
}

describe('section deep links', () => {
  it('assigns stable keys to duplicate headings in map order and skips preamble', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>intro</p><h2>Same</h2><h2>Same</h2>'

    applySectionMap(root, sectionMap)

    expect([...root.querySelectorAll('h2')].map((heading) => heading.getAttribute('data-section-key')))
      .toEqual(['same-first', 'same-second'])
    expect(root.querySelectorAll('h2')[1]!.getAttribute('data-stable-id')).toBe('sec_stable')
  })

  it('scrolls and highlights a valid key without failing on stale keys', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2 data-section-key="target">Target</h2>'
    const heading = root.querySelector('h2') as HTMLElement
    heading.scrollIntoView = vi.fn()
    heading.focus = vi.fn()

    expect(focusSection(root, 'target')).toBe(true)
    expect(heading.scrollIntoView).toHaveBeenCalled()
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(focusSection(root, 'stale')).toBe(false)
  })

  it('accepts a stable id from the section map as deep link target', () => {
    const root = document.createElement('div')
    root.innerHTML = '<h2>First</h2><h2>Second</h2>'
    applySectionMap(root, sectionMap)
    const heading = root.querySelectorAll('h2')[1] as HTMLElement
    heading.scrollIntoView = vi.fn()
    heading.focus = vi.fn()
    expect(focusSection(root, 'sec_stable')).toBe(true)
  })
})
