import type { PageSectionMapResponse } from '@/types'

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'

export function applySectionMap(root: HTMLElement, map: PageSectionMapResponse): void {
  const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
  const mappedSections = map.sections.filter((section) => section.heading !== null)
  headings.forEach((heading, index) => {
    const section = mappedSections[index]
    if (section) heading.dataset.sectionKey = section.key
  })
}

export function focusSection(root: HTMLElement, sectionKey: string): boolean {
  const heading = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
    .find((element) => element.dataset.sectionKey === sectionKey)
  if (!heading) return false
  heading.tabIndex = -1
  heading.scrollIntoView({ behavior: 'smooth', block: 'center' })
  heading.focus({ preventScroll: true })
  heading.classList.add('section-deep-link-highlight')
  window.setTimeout(() => heading.classList.remove('section-deep-link-highlight'), 1800)
  return true
}
