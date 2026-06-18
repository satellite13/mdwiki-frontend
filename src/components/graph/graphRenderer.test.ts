import { describe, expect, it } from 'vitest'
import { assignClusters } from './graphRenderer'

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
})
