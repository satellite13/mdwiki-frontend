export function previewHashtagName(el: Element | null): string | null {
  if (!el) return null
  const host = el.closest('.hashtag')
  if (!(host instanceof HTMLElement)) return null
  const fromData = host.dataset.tag?.trim()
  if (fromData) return fromData
  const text = host.textContent?.trim().replace(/^#/, '')
  return text || null
}
