import { describe, expect, it } from 'vitest'
import { isFrontmatterLocked, setFrontmatterField, stripMarkdownFrontmatter } from './frontmatter'

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

  it('does not strip up to a horizontal rule in the body when YAML was never closed', () => {
    const src = [
      '---',
      'title: Перевод',
      'source: prompting-best-practices',
      '',
      '# Основной текст статьи',
      '',
      'Параграфы идут здесь.',
      '',
      '---',
      '',
      '## Оригинал',
      '',
      'Перевод выполнен с документа [[prompting-best-practices]].'
    ].join('\n')
    expect(stripMarkdownFrontmatter(src)).toBe(src)
  })

  it('still strips when a real closing fence exists before markdown body', () => {
    const src = [
      '---',
      'title: OK',
      '---',
      '',
      '# После фронтматтера',
      '',
      '---',
      '',
      '## Хвост'
    ].join('\n')
    expect(stripMarkdownFrontmatter(src)).toBe('# После фронтматтера\n\n---\n\n## Хвост')
  })
})

describe('setFrontmatterField', () => {
  it('creates frontmatter when absent', () => {
    expect(setFrontmatterField('# Title\n\nbody', 'locked', true)).toBe(
      '---\nlocked: true\n---\n\n# Title\n\nbody'
    )
  })

  it('adds the key to an existing frontmatter block', () => {
    const src = '---\ntitle: Doc\n---\n\nbody'
    expect(setFrontmatterField(src, 'locked', true)).toBe(
      '---\ntitle: Doc\nlocked: true\n---\n\nbody'
    )
  })

  it('keeps the opening fence when updating an existing key (regression)', () => {
    const src = '---\ntitle: Doc\nlocked: false\n---\n\nbody'
    expect(setFrontmatterField(src, 'locked', true)).toBe(
      '---\ntitle: Doc\nlocked: true\n---\n\nbody'
    )
  })

  it('removes the key without dropping the opening fence', () => {
    const src = '---\ntitle: Doc\nlocked: true\n---\n\nbody'
    expect(setFrontmatterField(src, 'locked', false)).toBe('---\ntitle: Doc\n---\n\nbody')
  })

  it('returns source unchanged when removing a missing key', () => {
    const src = '---\ntitle: Doc\n---\n\nbody'
    expect(setFrontmatterField(src, 'locked', false)).toBe(src)
  })
})

describe('isFrontmatterLocked', () => {
  it('detects locked: true in frontmatter', () => {
    expect(isFrontmatterLocked('---\nlocked: true\n---\n\nbody')).toBe(true)
    expect(isFrontmatterLocked('---\ntitle: Doc\nlocked: true\n---\n\nbody')).toBe(true)
  })

  it('is false when locked is absent or false', () => {
    expect(isFrontmatterLocked('---\ntitle: Doc\n---\n\nbody')).toBe(false)
    expect(isFrontmatterLocked('---\nlocked: false\n---\n\nbody')).toBe(false)
    expect(isFrontmatterLocked('# no frontmatter')).toBe(false)
  })
})
