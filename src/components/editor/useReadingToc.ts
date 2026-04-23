import { ref } from 'vue'
import type { TocItem } from './tocTypes'

type RootGetter = () => HTMLElement | null

export function useReadingToc(getRoot: RootGetter) {
  const readingTocItems = ref<TocItem[]>([])

  function buildReadingToc() {
    const root = getRoot()
    if (!root) {
      readingTocItems.value = []
      return
    }
    const headings = Array.from(root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'))
    const items = headings.map((heading) => {
      const clone = heading.cloneNode(true) as HTMLElement
      clone.querySelectorAll('.heading-copy-btn').forEach((node) => node.remove())
      const permalink = clone.querySelector<HTMLElement>(':scope > .heading-anchor')
      let rawText = permalink?.textContent ?? clone.textContent ?? ''
      rawText = rawText.replace(/\s+/g, ' ').trim()
      // markdown-it-anchor permalink symbol is '#'; strip only the leading marker.
      const text = rawText.replace(/^#\s*/, '').trim() || heading.id
      const level = Number(heading.tagName[1])
      return { id: heading.id, text, level: Number.isFinite(level) ? level : 2 }
    })
    readingTocItems.value = items
  }

  function scrollToHeading(id: string) {
    const root = getRoot()
    if (!root) return
    const escaped = (globalThis.CSS && 'escape' in globalThis.CSS)
      ? globalThis.CSS.escape(id)
      : id.replace(/"/g, '\\"')
    const heading = root.querySelector<HTMLElement>(`#${escaped}`)
    if (!heading) return
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return {
    readingTocItems,
    buildReadingToc,
    scrollToHeading
  }
}
