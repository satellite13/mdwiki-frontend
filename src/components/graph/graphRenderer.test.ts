import { describe, expect, it } from 'vitest'
import {
  assignClusters,
  collapseBidirectionalEdges,
  createNodeMotion,
  flowStrokeForZoom,
  linkFlowReversed,
  outgoingNeighborSlug,
  inboundDegrees,
  nodeVisualRadius,
  organismOffset,
  visualNodePosition
} from './graphRenderer'

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

describe('organismOffset', () => {
  it('is deterministic for the same slug and time', () => {
    const motion = createNodeMotion('architecture', { clusterId: 1 })
    expect(organismOffset(motion, 3.2)).toEqual(organismOffset(motion, 3.2))
  })

  it('moves over time and stays within a small living range', () => {
    const motion = createNodeMotion('architecture', { clusterId: 1 })
    const a = organismOffset(motion, 0)
    const b = organismOffset(motion, 1.7)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.4)
    expect(Math.hypot(a.x, a.y)).toBeLessThan(9)
    expect(Math.hypot(b.x, b.y)).toBeLessThan(9)
  })

  it('gives the current page a quieter motion than a regular node', () => {
    const current = createNodeMotion('home', { isCurrent: true, clusterId: 0 })
    const regular = createNodeMotion('home', { isCurrent: false, clusterId: 0 })
    const samples = [0, 0.8, 1.6, 2.4, 3.5]
    const currentMax = Math.max(...samples.map((t) => {
      const p = organismOffset(current, t)
      return Math.hypot(p.x, p.y)
    }))
    const regularMax = Math.max(...samples.map((t) => {
      const p = organismOffset(regular, t)
      return Math.hypot(p.x, p.y)
    }))
    expect(currentMax).toBeLessThan(regularMax)
  })
})

describe('visualNodePosition', () => {
  it('adds organism offset on top of the simulation point', () => {
    expect(visualNodePosition({ x: 100, y: 40, ox: 2.5, oy: -1 })).toEqual({ x: 102.5, y: 39 })
  })
})

describe('collapseBidirectionalEdges', () => {
  it('keeps a one-way link as a single directed edge', () => {
    expect(collapseBidirectionalEdges([{ source: 'a', target: 'b' }])).toEqual([
      { source: 'a', target: 'b', bidirectional: false }
    ])
  })

  it('merges opposite links into one two-headed edge', () => {
    expect(
      collapseBidirectionalEdges([
        { source: 'a', target: 'b' },
        { source: 'c', target: 'd' },
        { source: 'b', target: 'a' }
      ])
    ).toEqual([
      { source: 'a', target: 'b', bidirectional: true },
      { source: 'c', target: 'd', bidirectional: false }
    ])
  })

  it('drops duplicate one-way copies of the same pair', () => {
    expect(
      collapseBidirectionalEdges([
        { source: 'a', target: 'b' },
        { source: 'a', target: 'b' }
      ])
    ).toEqual([{ source: 'a', target: 'b', bidirectional: false }])
  })
})

describe('outgoingNeighborSlug', () => {
  const oneWay = { source: 'a', target: 'b', bidirectional: false }
  const bothWays = { source: 'a', target: 'b', bidirectional: true }

  it('follows a one-way link only from the source', () => {
    expect(outgoingNeighborSlug(oneWay, 'a')).toBe('b')
    expect(outgoingNeighborSlug(oneWay, 'b')).toBeNull()
  })

  it('follows a two-headed link from either end', () => {
    expect(outgoingNeighborSlug(bothWays, 'a')).toBe('b')
    expect(outgoingNeighborSlug(bothWays, 'b')).toBe('a')
  })
})

describe('linkFlowReversed', () => {
  const oneWay = { source: 'a', target: 'b', bidirectional: false }
  const bothWays = { source: 'a', target: 'b', bidirectional: true }

  it('keeps flow along the drawn path when leaving the source', () => {
    expect(linkFlowReversed(oneWay, 'a')).toBe(false)
    expect(linkFlowReversed(bothWays, 'a')).toBe(false)
  })

  it('reverses flow when a two-way link is entered from the target', () => {
    expect(linkFlowReversed(bothWays, 'b')).toBe(true)
    expect(linkFlowReversed(oneWay, 'b')).toBe(false)
  })
})

describe('flowStrokeForZoom', () => {
  it('keeps screen-sized dashes when the graph is zoomed out', () => {
    const fitted = flowStrokeForZoom(0.12)
    const close = flowStrokeForZoom(1)
    expect(fitted.dash).toBeGreaterThan(close.dash * 6)
    expect(fitted.gap / fitted.dash).toBeCloseTo(close.gap / close.dash, 5)
    expect(fitted.width).toBe(close.width)
  })

  it('keeps ants sparse and thinner than the gap', () => {
    const stroke = flowStrokeForZoom(1)
    expect(stroke.gap / stroke.dash).toBeGreaterThan(10)
    expect(stroke.width).toBeGreaterThan(1.75)
    expect(stroke.width).toBeLessThan(4)
    expect(stroke.period).toBe(stroke.dash * 2 + stroke.pair + stroke.gap)
  })
})
