import { describe, expect, it } from 'vitest'
import { stripMarkdownFrontmatter } from './frontmatter'

describe('stripMarkdownFrontmatter', () => {
  it('removes a simple YAML frontmatter block at the start', () => {
    const src = `---\ntitle: Page\ntags: [a, b]\n---\n\n# Heading\nBody`
    expect(stripMarkdownFrontmatter(src)).toBe('# Heading\nBody')
  })

  it('returns source unchanged when no frontmatter is present', () => {
    const src = '# Heading\n\nSome body'
    expect(stripMarkdownFrontmatter(src)).toBe(src)
  })

  it('does not treat a mid-document separator as frontmatter', () => {
    const src = '# Heading\n\n---\n\nParagraph'
    expect(stripMarkdownFrontmatter(src)).toBe(src)
  })

  it('handles BOM-prefixed frontmatter', () => {
    const src = `\uFEFF---\nkey: value\n---\nhello`
    expect(stripMarkdownFrontmatter(src)).toBe('hello')
  })

  it('handles CRLF line endings', () => {
    const src = '---\r\ntitle: X\r\n---\r\nbody'
    expect(stripMarkdownFrontmatter(src)).toBe('body')
  })

  it('is safe for null/undefined-ish inputs', () => {
    expect(stripMarkdownFrontmatter('')).toBe('')
    // @ts-expect-error — runtime guard check
    expect(stripMarkdownFrontmatter(undefined)).toBe('')
  })
})
