import { describe, expect, it } from 'vitest'
import { parseStructurizrDsl, renderStructurizrSvg } from './structurizr'

describe('Structurizr renderer', () => {
  it('parses a basic DSL graph', () => {
    const parsed = parseStructurizrDsl(`
      user = person "User"
      app = softwareSystem "MDWiki"
      user -> app "Uses"
    `)

    expect(parsed.nodes).toHaveLength(2)
    expect(parsed.edges).toEqual([{ source: 'user', target: 'app', label: 'Uses' }])
  })

  it('renders an svg and escapes labels', () => {
    const svg = renderStructurizrSvg(`
      user = person "<User>"
      app = softwareSystem "MDWiki"
      user -> app "Reads <pages>"
    `, false)

    expect(svg).toContain('<svg')
    expect(svg).toContain('&lt;User&gt;')
    expect(svg).toContain('&lt;pages&gt;')
    expect(svg).not.toContain('<User>')
  })
})
