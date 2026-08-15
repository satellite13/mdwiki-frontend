import { describe, expect, it } from 'vitest'
import {
  applyPreviewFindHighlights,
  clearPreviewFindHighlights,
  collectPreviewTextNodes,
  findPreviewMatchRanges
} from './previewFind'

function htmlRoot(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('collectPreviewTextNodes', () => {
  it('skips copy buttons and empty nodes', () => {
    const root = htmlRoot(
      '<p>Visible</p><button class="heading-copy-btn">copy</button><p> </p>'
    )
    const texts = collectPreviewTextNodes(root).map((n) => n.textContent)
    expect(texts).toEqual(['Visible'])
  })
})

describe('findPreviewMatchRanges', () => {
  it('finds case-insensitive matches across inline elements', () => {
    const root = htmlRoot('<p>He<strong>llo</strong> world hello</p>')
    const matches = findPreviewMatchRanges(root, 'hello')
    expect(matches).toHaveLength(2)
    expect(matches[0].map((p) => p.node.textContent?.slice(p.start, p.end)).join('')).toBe('Hello')
    expect(matches[1]).toHaveLength(1)
    expect(matches[1][0].node.textContent?.slice(matches[1][0].start, matches[1][0].end)).toBe('hello')
  })

  it('returns empty for blank query', () => {
    const root = htmlRoot('<p>hello</p>')
    expect(findPreviewMatchRanges(root, '   ')).toEqual([])
  })
})

describe('applyPreviewFindHighlights', () => {
  it('wraps matches and marks the active one', () => {
    const root = htmlRoot('<p>Foo bar foo</p>')
    const count = applyPreviewFindHighlights(root, 'foo', 1)
    expect(count).toBe(2)
    const marks = root.querySelectorAll('mark.find-match')
    expect(marks).toHaveLength(2)
    expect(marks[0].textContent).toBe('Foo')
    expect(marks[1].classList.contains('find-match-active')).toBe(true)
    expect(marks[1].textContent).toBe('foo')
  })

  it('replaces previous highlights on refresh', () => {
    const root = htmlRoot('<p>alpha beta alpha</p>')
    applyPreviewFindHighlights(root, 'alpha', 0)
    const count = applyPreviewFindHighlights(root, 'beta', 0)
    expect(count).toBe(1)
    expect(root.querySelectorAll('mark.find-match')).toHaveLength(1)
    expect(root.textContent).toBe('alpha beta alpha')
  })

  it('clears highlights without changing visible text', () => {
    const root = htmlRoot('<p>Foo bar foo</p>')
    applyPreviewFindHighlights(root, 'foo', 0)
    clearPreviewFindHighlights(root)
    expect(root.querySelectorAll('mark.find-match')).toHaveLength(0)
    expect(root.textContent).toBe('Foo bar foo')
  })
})
