export const MERMAID_EXPAND_BTN_CLASS = 'mermaid-expand-btn'

export function decorateMermaidExpandButtons(root: HTMLElement | null, label: string) {
  if (!root) return
  root.querySelectorAll<HTMLElement>('.mermaid').forEach((block) => {
    if (!block.querySelector(':scope > svg')) return
    if (block.querySelector(`:scope > .${MERMAID_EXPAND_BTN_CLASS}`)) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = MERMAID_EXPAND_BTN_CLASS
    button.title = label
    button.setAttribute('aria-label', label)
    button.innerHTML = '<span class="material-symbols-outlined notranslate" translate="no">open_in_full</span>'
    block.appendChild(button)
  })
}

export function mermaidSvgHtmlFromEvent(event: Event): string | null {
  const target = event.target
  if (!(target instanceof Element)) return null
  const button = target.closest<HTMLButtonElement>(`.${MERMAID_EXPAND_BTN_CLASS}`)
  if (!button) return null
  event.preventDefault()
  event.stopPropagation()
  const svg = button.closest('.mermaid')?.querySelector(':scope > svg')
  return svg?.outerHTML ?? null
}
