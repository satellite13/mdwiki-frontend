import { describe, expect, it } from 'vitest'
import { assignClusters, inboundDegrees, nodeVisualRadius } from './graphRenderer'

describe('inboundDegrees', () => {
  it('counts incoming links per target slug', () => {
    const degrees = inboundDegrees([
      { source: 'a', target: 'hub' },
      { source: 'b', target: 'hub' },
      { source: 'hub', target: 'c' }
    ])
    expect(degrees.get('hub')).toBe(2)
    expect(degrees.get('c')).toBe(1)
    expect(degrees.get('a')).toBeUndefined()
  })
})

describe('nodeVisualRadius', () => {
  it('grows with inbound degree and keeps a floor for the current page', () => {
    expect(nodeVisualRadius(0, false)).toBeLessThan(nodeVisualRadius(4, false))
    expect(nodeVisualRadius(9, false)).toBeGreaterThan(nodeVisualRadius(4, false))
    expect(nodeVisualRadius(0, true)).toBeGreaterThanOrEqual(nodeVisualRadius(0, false))
    expect(nodeVisualRadius(100, false)).toBeLessThanOrEqual(22)
  })
})

describe('assignClusters', () => {
  it('groups connected nodes and merges singletons into one cluster', () => {
    const slugs = ['a', 'b', 'c', 'd', 'e']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' }
    ]
    const clusters = assignClusters(slugs, edges)
    expect(clusters.get('a')).toBe(clusters.get('b'))
    expect(clusters.get('c')).toBe(clusters.get('d'))
    expect(clusters.get('a')).not.toBe(clusters.get('c'))
    expect(clusters.get('e')).toBeDefined()
    expect(new Set(clusters.values()).size).toBe(3)
  })

  it('splits dense communities that share only a weak bridge', () => {
    const slugs = ['a', 'b', 'c', 'd', 'e', 'f']
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
      { source: 'd', target: 'e' },
      { source: 'e', target: 'f' },
      { source: 'f', target: 'd' },
      { source: 'a', target: 'd' }
    ]
    const clusters = assignClusters(slugs, edges)
    const left = new Set([clusters.get('a'), clusters.get('b'), clusters.get('c')])
    const right = new Set([clusters.get('d'), clusters.get('e'), clusters.get('f')])
    expect(left.size).toBe(1)
    expect(right.size).toBe(1)
    expect([...left][0]).not.toBe([...right][0])
  })
})
