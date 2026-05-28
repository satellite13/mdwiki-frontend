export type PreviewLinkKind = 'external' | 'internal'

/** Классификация href для preview/reading (не для wikilink-токенов). */
export function classifyPreviewLinkHref(href: string): PreviewLinkKind {
  const trimmed = href.trim()
  if (!trimmed) return 'internal'

  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return 'external'
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return 'external'
  }

  return 'internal'
}
