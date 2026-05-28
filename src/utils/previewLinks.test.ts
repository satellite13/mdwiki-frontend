import { describe, expect, it } from 'vitest'
import { classifyPreviewLinkHref } from './previewLinks'

describe('classifyPreviewLinkHref', () => {
  it('classifies http(s) and protocol-relative as external', () => {
    expect(classifyPreviewLinkHref('https://github.com')).toBe('external')
    expect(classifyPreviewLinkHref('http://example.com')).toBe('external')
    expect(classifyPreviewLinkHref('//cdn.example.com/x')).toBe('external')
  })

  it('classifies mailto and tel as external', () => {
    expect(classifyPreviewLinkHref('mailto:a@b.c')).toBe('external')
    expect(classifyPreviewLinkHref('tel:+123')).toBe('external')
  })

  it('classifies /page, anchors and relative paths as internal', () => {
    expect(classifyPreviewLinkHref('/page/foo')).toBe('internal')
    expect(classifyPreviewLinkHref('#section')).toBe('internal')
    expect(classifyPreviewLinkHref('other-page')).toBe('internal')
  })

  it('classifies other schemes as external', () => {
    expect(classifyPreviewLinkHref('ftp://files.example/x')).toBe('external')
  })
})
