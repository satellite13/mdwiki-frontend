import { describe, expect, it } from 'vitest'
import {
  MERMAID_EXPAND_BTN_CLASS,
  decorateMermaidExpandButtons,
  mermaidSvgHtmlFromEvent
} from './mermaidFullscreen'

function clickEvent(target: Element) {
  return {
    target,
    preventDefault() {},
    stopPropagation() {}
  } as unknown as Event
}

describe('decorateMermaidExpandButtons', () => {
  it('adds an expand button only when a mermaid block has an svg', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="mermaid"><svg><g></g></svg></div>
      <div class="mermaid">flowchart TD; A-->B</div>
    `
    decorateMermaidExpandButtons(root, 'Expand diagram')

    const rendered = root.querySelectorAll('.mermaid')[0]
    const failed = root.querySelectorAll('.mermaid')[1]
    const button = rendered?.querySelector(`:scope > .${MERMAID_EXPAND_BTN_CLASS}`)
    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect(button?.getAttribute('aria-label')).toBe('Expand diagram')
    expect(button?.querySelector('.material-symbols-outlined')?.textContent?.trim()).toBe('open_in_full')
    expect(failed?.querySelector(`.${MERMAID_EXPAND_BTN_CLASS}`)).toBeNull()
  })

  it('does not duplicate the button on a second pass', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="mermaid"><svg></svg></div>'
    decorateMermaidExpandButtons(root, 'Expand diagram')
    decorateMermaidExpandButtons(root, 'Expand diagram')
    expect(root.querySelectorAll(`.${MERMAID_EXPAND_BTN_CLASS}`)).toHaveLength(1)
  })
})

describe('mermaidSvgHtmlFromEvent', () => {
  it('returns the svg markup when the expand button is clicked', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="mermaid"><svg id="chart"><g></g></svg></div>'
    decorateMermaidExpandButtons(root, 'Expand diagram')
    const button = root.querySelector(`.${MERMAID_EXPAND_BTN_CLASS}`)
    expect(mermaidSvgHtmlFromEvent(clickEvent(button!))).toContain('id="chart"')
  })

  it('returns null for unrelated clicks', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="mermaid"><svg></svg><a class="wikilink">page</a></div>'
    expect(mermaidSvgHtmlFromEvent(clickEvent(root.querySelector('a')!))).toBeNull()
  })
})
