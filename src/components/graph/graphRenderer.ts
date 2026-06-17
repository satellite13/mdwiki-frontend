import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/api/graph'

export interface SimNode extends d3.SimulationNodeDatum {
  slug: string
  title: string
  tags: string[]
  isCurrent: boolean
  exists: boolean
  clusterId: number
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string
  target: SimNode | string
}

export interface GraphRenderOptions {
  svg: SVGSVGElement
  variant: 'page' | 'wiki'
  nodes: GraphNode[]
  edges: GraphEdge[]
  markerKey: string
  onNodeClick: (slug: string) => void
}

export interface GraphRenderHandle {
  stop(): void
}

interface ClusterHalo {
  clusterId: number
  cx: number
  cy: number
  rx: number
  ry: number
}

const CLUSTER_PALETTE = [
  'var(--color-primary, #0d9488)',
  '#3b82f6',
  '#8b5cf6',
  '#d97706',
  '#e11d48',
  '#0891b2',
  '#65a30d',
  '#db2777'
]

function nodeRadius(d: SimNode): number {
  return d.isCurrent ? 10 : 5.5
}

function clusterTint(clusterId: number): string {
  return CLUSTER_PALETTE[clusterId % CLUSTER_PALETTE.length]!
}

function measureSvg(el: SVGSVGElement): { width: number; height: number } {
  const r = el.getBoundingClientRect()
  const w = Math.max(120, Math.floor(r.width || el.clientWidth))
  const h = Math.max(120, Math.floor(r.height || el.clientHeight))
  return { width: w, height: h }
}

function fitBoundsTransform(nodes: SimNode[], w: number, h: number): d3.ZoomTransform {
  if (!nodes.length || w < 16 || h < 16) return d3.zoomIdentity

  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const d of nodes) {
    const x = d.x ?? 0
    const y = d.y ?? 0
    const r = nodeRadius(d) + 12
    const below = nodeRadius(d) + 20
    x0 = Math.min(x0, x - r)
    x1 = Math.max(x1, x + r)
    y0 = Math.min(y0, y - r)
    y1 = Math.max(y1, y + below)
  }
  if (!Number.isFinite(x0)) return d3.zoomIdentity

  const dx = x1 - x0
  const dy = y1 - y0
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const pad = 40
  if (dx < 6 && dy < 6) {
    return d3.zoomIdentity.translate(w / 2 - cx, h / 2 - cy)
  }
  const sx = (w - 2 * pad) / dx
  const sy = (h - 2 * pad) / dy
  const k = Math.max(0.06, Math.min(sx, sy, 3.2) * 0.9)
  return d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-cx, -cy)
}

function linkLineCoords(s: SimNode, t: SimNode): { x1: number; y1: number; x2: number; y2: number } {
  const sx = s.x ?? 0
  const sy = s.y ?? 0
  const tx = t.x ?? 0
  const ty = t.y ?? 0
  const dx = tx - sx
  const dy = ty - sy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x1: sx, y1: sy, x2: tx, y2: ty }
  const ux = dx / len
  const uy = dy / len
  const rs = nodeRadius(s) + 2.5
  const rt = nodeRadius(t) + 2
  return {
    x1: sx + ux * rs,
    y1: sy + uy * rs,
    x2: tx - ux * rt,
    y2: ty - uy * rt
  }
}

function linkCurvePath(s: SimNode, t: SimNode): string {
  const { x1, y1, x2, y2 } = linkLineCoords(s, t)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return `M${x1},${y1}L${x2},${y2}`
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const bend = Math.min(18, len * 0.12)
  const nx = (-dy / len) * bend
  const ny = (dx / len) * bend
  return `M${x1},${y1} Q${mx + nx},${my + ny} ${x2},${y2}`
}

function alignEdgesToNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const lowerToCanon = new Map<string, string>()
  for (const n of nodes) {
    lowerToCanon.set(n.slug.toLowerCase(), n.slug)
  }
  const canon = (s: string) => lowerToCanon.get(s.toLowerCase()) ?? s
  const exact = new Set(nodes.map((n) => n.slug))
  return edges
    .map((e) => ({ source: canon(String(e.source)), target: canon(String(e.target)) }))
    .filter((e) => exact.has(e.source) && exact.has(e.target))
}

class UnionFind {
  private parent = new Map<string, string>()

  constructor(items: string[]) {
    for (const item of items) this.parent.set(item, item)
  }

  find(x: string): string {
    let root = this.parent.get(x)!
    while (root !== this.parent.get(root)) {
      root = this.parent.get(root)!
    }
    let cursor = x
    while (cursor !== root) {
      const next = this.parent.get(cursor)!
      this.parent.set(cursor, root)
      cursor = next
    }
    return root
  }

  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  groups(): Map<string, Set<string>> {
    const groups = new Map<string, Set<string>>()
    for (const item of this.parent.keys()) {
      const root = this.find(item)
      if (!groups.has(root)) groups.set(root, new Set())
      groups.get(root)!.add(item)
    }
    return groups
  }
}

/** Связные компоненты → облака; одиночные узлы собираются в одно «островное» облако. */
export function assignClusters(slugs: string[], edges: GraphEdge[]): Map<string, number> {
  const uf = new UnionFind(slugs)
  for (const edge of edges) uf.union(edge.source, edge.target)

  const multi: Set<string>[] = []
  const singles: string[] = []
  for (const members of uf.groups().values()) {
    if (members.size >= 2) multi.push(members)
    else singles.push([...members][0]!)
  }

  const result = new Map<string, number>()
  let clusterId = 0
  for (const members of multi) {
    for (const slug of members) result.set(slug, clusterId)
    clusterId++
  }
  if (singles.length) {
    for (const slug of singles) result.set(slug, clusterId)
    clusterId++
  }
  return result
}

function layoutClusterCenters(count: number, width: number, height: number): { x: number; y: number }[] {
  if (count <= 0) return []
  const cx = width / 2
  const cy = height / 2
  if (count === 1) return [{ x: cx, y: cy }]
  const radius = Math.min(width, height) * (count > 6 ? 0.36 : 0.3)
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

function forceCluster(centers: { x: number; y: number }[]) {
  let nodes: SimNode[] = []
  let strength = 0.1

  function force(alpha: number) {
    for (const node of nodes) {
      const center = centers[node.clusterId]
      if (!center) continue
      const dx = center.x - (node.x ?? 0)
      const dy = center.y - (node.y ?? 0)
      node.vx = (node.vx ?? 0) + dx * strength * alpha
      node.vy = (node.vy ?? 0) + dy * strength * alpha
    }
  }

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes
  }
  force.strength = (value: number) => {
    strength = value
    return force
  }
  return force
}

function computeClusterHalos(nodes: SimNode[]): ClusterHalo[] {
  const grouped = d3.group(nodes, (d) => d.clusterId)
  const halos: ClusterHalo[] = []
  for (const [clusterId, members] of grouped) {
    if (members.length === 0) continue
    const xs = members.map((n) => n.x ?? 0)
    const ys = members.map((n) => n.y ?? 0)
    const cx = d3.mean(xs) ?? 0
    const cy = d3.mean(ys) ?? 0
    const spreadX = d3.max(xs.map((x) => Math.abs(x - cx))) ?? 0
    const spreadY = d3.max(ys.map((y) => Math.abs(y - cy))) ?? 0
    const rx = Math.max(36, spreadX + 34)
    const ry = Math.max(30, spreadY + 28)
    halos.push({ clusterId, cx, cy, rx, ry })
  }
  return halos
}

function buildSimNodes(
  nodes: GraphNode[],
  clusterBySlug: Map<string, number>,
  centers: { x: number; y: number }[],
  width: number,
  height: number,
  variant: 'page' | 'wiki'
): SimNode[] {
  const cx = width / 2
  const cy = height / 2
  const others = nodes.filter((n) => !n.isCurrent)
  const ring = Math.min(width, height) * 0.3

  return nodes.map((n, idx) => {
    const clusterId = clusterBySlug.get(n.slug) ?? 0
    const center = centers[clusterId] ?? { x: cx, y: cy }

    if (n.isCurrent) {
      return { ...n, clusterId, x: cx, y: cy, fx: cx, fy: cy }
    }

    if (variant === 'wiki' && centers.length > 1) {
      const angle = (idx * 2.399963) % (2 * Math.PI)
      const spread = 18 + (idx % 7) * 6
      return {
        ...n,
        clusterId,
        x: center.x + Math.cos(angle) * spread,
        y: center.y + Math.sin(angle) * spread
      }
    }

    const k = others.indexOf(n)
    const nOthers = Math.max(others.length, 1)
    const angle = (2 * Math.PI * k) / nOthers - Math.PI / 2
    const jitter = 0.88 + (idx % 5) * 0.025
    return {
      ...n,
      clusterId,
      x: cx + Math.cos(angle) * ring * jitter,
      y: cy + Math.sin(angle) * ring * jitter
    }
  })
}

/**
 * Полностью рендерит граф: чистит SVG, запускает force-симуляцию d3,
 * привязывает zoom/drag/click и подгоняет масштаб под видимую область.
 */
export function renderGraph(options: GraphRenderOptions): GraphRenderHandle {
  const { svg: svgEl, variant, nodes, edges, markerKey, onNodeClick } = options

  const svg = d3.select<SVGSVGElement, unknown>(svgEl)
  svg.selectAll('*').remove()

  const wiki = variant === 'wiki'
  const { width, height } = measureSvg(svgEl)
  const alignedEdges = alignEdgesToNodes(nodes, edges)
  const simLinks: SimLink[] = alignedEdges.map((e) => ({
    source: e.source,
    target: e.target
  }))

  const slugs = nodes.map((n) => n.slug)
  const clusterBySlug = assignClusters(slugs, alignedEdges)
  const clusterCount = clusterBySlug.size ? Math.max(...clusterBySlug.values()) + 1 : 1
  const clusterCenters = layoutClusterCenters(wiki ? clusterCount : 1, width, height)
  const simNodes = buildSimNodes(nodes, clusterBySlug, clusterCenters, width, height, variant)

  const linkDist = wiki ? 42 + Math.min(width, height) * 0.035 : 78 + Math.min(width, height) * 0.07
  const charge = wiki ? -Math.min(900, 140 + nodes.length * 5) : -420
  const collideR = wiki ? Math.max(12, Math.min(24, 280 / Math.sqrt(Math.max(nodes.length, 1)))) : 26
  const clusterForce = forceCluster(clusterCenters).strength(wiki && clusterCount > 1 ? 0.14 : 0.05)

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.slug)
        .distance(linkDist)
        .strength(wiki ? 0.28 : 0.5)
    )
    .force('charge', d3.forceManyBody().strength(charge).distanceMax(wiki ? 280 : 420))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(wiki ? 0.03 : 0.1))
    .force('collision', d3.forceCollide<SimNode>().radius((d) => (d.isCurrent ? 30 : collideR)))
    .force('cluster', clusterForce)
    .velocityDecay(wiki ? 0.64 : 0.56)

  const rootG = svg.append('g')

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.04, 4])
    .on('zoom', (event) => rootG.attr('transform', event.transform))
  svg.call(zoom)

  const defs = svg.append('defs')

  const markerId = `arrowhead-${markerKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  defs
    .append('marker')
    .attr('id', markerId)
    .attr('viewBox', '0 -2 5 4')
    .attr('refX', 4.5)
    .attr('refY', 0)
    .attr('markerUnits', 'userSpaceOnUse')
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-1.6L4.5,0L0,1.6')
    .attr('fill', 'var(--color-text-faint, #8b949e)')

  const glowId = `node-glow-${markerKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const glow = defs.append('filter').attr('id', glowId).attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
  glow.append('feGaussianBlur').attr('stdDeviation', '2.2').attr('result', 'blur')
  const merge = glow.append('feMerge')
  merge.append('feMergeNode').attr('in', 'blur')
  merge.append('feMergeNode').attr('in', 'SourceGraphic')

  const haloRoot = rootG.append('g').attr('class', 'graph-halos')
  const linkRoot = rootG.append('g').attr('class', 'graph-links')
  const nodeRoot = rootG.append('g').attr('class', 'graph-nodes')

  const halos = haloRoot
    .selectAll<SVGEllipseElement, ClusterHalo>('ellipse')
    .data(computeClusterHalos(simNodes))
    .join('ellipse')
    .attr('rx', (d) => d.rx)
    .attr('ry', (d) => d.ry)
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => d.cy)
    .attr('fill', (d) => clusterTint(d.clusterId))
    .attr('fill-opacity', wiki && clusterCount > 1 ? 0.05 : 0)
    .attr('stroke', (d) => clusterTint(d.clusterId))
    .attr('stroke-opacity', wiki && clusterCount > 1 ? 0.1 : 0)
    .attr('stroke-width', 0.75)
    .style('pointer-events', 'none')

  const link = linkRoot
    .selectAll('path')
    .data(simLinks)
    .join('path')
    .attr('fill', 'none')
    .style('stroke', 'var(--color-text-faint, #8b949e)')
    .attr('stroke-width', 0.75)
    .attr('stroke-opacity', 0.55)
    .attr('marker-end', `url(#${markerId})`)
    .style('pointer-events', 'none')

  const node = nodeRoot
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .attr('class', 'graph-node')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => onNodeClick(d.slug))
    .call(
      d3
        .drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.28).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          if (!d.isCurrent) {
            d.fx = null
            d.fy = null
          }
        })
    )

  node
    .filter((d) => d.isCurrent)
    .append('circle')
    .attr('r', 16)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-primary, #0d9488)')
    .attr('stroke-opacity', 0.22)
    .attr('stroke-width', 1)

  node
    .append('circle')
    .attr('class', 'graph-node__dot')
    .attr('r', (d) => nodeRadius(d))
    .attr('fill', (d) => {
      if (d.isCurrent) return 'var(--color-primary, #0d9488)'
      if (!d.exists) return 'var(--color-warning, #f59e0b)'
      if (wiki && clusterCount > 1) return clusterTint(d.clusterId)
      return 'var(--color-text-muted, #656d76)'
    })
    .attr('fill-opacity', (d) => (d.isCurrent ? 1 : 0.92))
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 1.5)
    .attr('filter', (d) => (d.isCurrent ? `url(#${glowId})` : null))

  node
    .filter((d) => !d.exists)
    .append('circle')
    .attr('r', (d) => nodeRadius(d) + 2.5)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-warning, #f59e0b)')
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', 0.75)
    .attr('stroke-dasharray', '2 2')

  node
    .append('text')
    .text((d) => (d.title.length > 22 ? d.title.slice(0, 20) + '\u2026' : d.title))
    .attr('x', 0)
    .attr('y', (d) => nodeRadius(d) + (d.isCurrent ? 14 : 12))
    .attr('text-anchor', 'middle')
    .attr('font-size', (d) => (d.isCurrent ? '11px' : '9.5px'))
    .attr('font-weight', (d) => (d.isCurrent ? '600' : '450'))
    .attr('letter-spacing', '0.01em')
    .attr('fill', 'var(--color-text, #24292f)')
    .attr('paint-order', 'stroke fill')
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round')

  node.append('title').text((d) => `${d.title}${d.tags.length ? '\nTags: ' + d.tags.map((tag) => '#' + tag).join(', ') : ''}`)

  simulation.on('tick', () => {
    link.attr('d', (d) => {
      if (typeof d.source === 'string' || typeof d.target === 'string') return ''
      return linkCurvePath(d.source as SimNode, d.target as SimNode)
    })
    node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

    if (wiki && clusterCount > 1) {
      const haloData = computeClusterHalos(simNodes)
      halos.data(haloData).attr('cx', (d) => d.cx).attr('cy', (d) => d.cy).attr('rx', (d) => d.rx).attr('ry', (d) => d.ry)
    }
  })

  simulation.alpha(1).restart()
  const tickCap = wiki ? 700 : 240
  for (let i = 0; i < tickCap && simulation.alpha() > 0.02; i++) {
    simulation.tick()
  }

  svg.call(zoom.transform, fitBoundsTransform(simNodes, width, height))

  if (wiki) {
    simulation.alpha(0)
  } else {
    simulation.alpha(0.3).restart()
  }

  return {
    stop() {
      simulation.stop()
    }
  }
}
