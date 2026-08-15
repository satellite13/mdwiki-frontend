import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import {
  bindMermaidWikilinkNodes,
  mermaidNodeIdFromSlug,
  rewriteMermaidWikilinks
} from './mermaidWikilinks'

describe('mermaidNodeIdFromSlug', () => {
  it('turns hyphenated slugs into mermaid-safe ids', () => {
    expect(mermaidNodeIdFromSlug('react-loop')).toBe('react_loop')
  })

  it('prefixes ids that would start with a digit', () => {
    expect(mermaidNodeIdFromSlug('2024-notes')).toBe('n_2024_notes')
  })
})

describe('rewriteMermaidWikilinks', () => {
  it('rewrites labeled wikilink nodes with an existing id', () => {
    const { source, bindings } = rewriteMermaidWikilinks(
      'flowchart TD\n    A[[react-loop|ReAct]] --> B[[ralph-loop|Ralph]]\n'
    )

    expect(source).toBe('flowchart TD\n    A["ReAct"] --> B["Ralph"]\n')
    expect(bindings).toEqual([
      { nodeId: 'A', slug: 'react-loop', label: 'ReAct' },
      { nodeId: 'B', slug: 'ralph-loop', label: 'Ralph' }
    ])
  })

  it('synthesizes a node id from the slug when the author omitted one', () => {
    const { source, bindings } = rewriteMermaidWikilinks(
      'flowchart TD\n    [[react-loop|ReAct]] --> [[ralph-loop|Ralph]]\n'
    )

    expect(source).toBe('flowchart TD\n    react_loop["ReAct"] --> ralph_loop["Ralph"]\n')
    expect(bindings.map((b) => b.nodeId)).toEqual(['react_loop', 'ralph_loop'])
  })

  it('leaves unlabeled [[slug]] and quoted labels unchanged', () => {
    const src =
      'flowchart TD\n    A[[Subroutine]]\n    B["[[react-loop|ReAct]]"]\n    %% A[[skip|me]]\n'
    const { source, bindings } = rewriteMermaidWikilinks(src)

    expect(source).toBe(src)
    expect(bindings).toEqual([])
  })

  it('does not rewrite wikilinks used as edge labels', () => {
    const src = 'flowchart TD\n    A -->|[[react-loop|ReAct]]| B\n'
    const { source, bindings } = rewriteMermaidWikilinks(src)

    expect(source).toBe(src)
    expect(bindings).toEqual([])
  })

  it('escapes quotes inside the visible label', () => {
    const { source } = rewriteMermaidWikilinks('flowchart TD\n    A[[page|He said "hi"]]\n')
    expect(source).toContain('A["He said #quot;hi#quot;"]')
  })
})

describe('bindMermaidWikilinkNodes', () => {
  it('wraps matching mermaid nodes in a wikilink anchor', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <svg>
        <g class="node" id="flowchart-A-0"><text>ReAct</text></g>
        <g class="node" id="flowchart-B-0"><text>Other</text></g>
      </svg>
    `

    bindMermaidWikilinkNodes(root, [{ nodeId: 'A', slug: 'react-loop', label: 'ReAct' }], {
      hrefForSlug: (slug) => `/page/${slug}`,
      isMissing: () => false
    })

    const link = root.querySelector('a.wikilink')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/page/react-loop')
    expect(link?.getAttribute('data-slug')).toBe('react-loop')
    expect(link?.getAttribute('data-wikilink')).toBe('1')
    expect(link?.querySelector('#flowchart-A-0')).not.toBeNull()
    expect(root.querySelector('#flowchart-B-0')?.parentElement?.tagName.toLowerCase()).not.toBe('a')
  })

  it('marks missing pages on the wrapper', () => {
    const root = document.createElement('div')
    root.innerHTML = `<svg><g class="node" id="mermaid-x-react_loop-0"></g></svg>`

    bindMermaidWikilinkNodes(
      root,
      [{ nodeId: 'react_loop', slug: 'react-loop', label: 'ReAct' }],
      { hrefForSlug: (slug) => `/page/${slug}`, isMissing: () => true }
    )

    expect(root.querySelector('a')?.getAttribute('class')).toContain('wikilink-missing')
  })

  it('makes labeled wikilink diagrams parseable by mermaid', async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
    const original = 'flowchart TD\n    A[[react-loop|ReAct]] --> B[[ralph-loop|Ralph]]\n'
    await expect(mermaid.parse(original)).rejects.toThrow()
    const { source } = rewriteMermaidWikilinks(original)
    await expect(mermaid.parse(source)).resolves.toBeTruthy()
  })
})
