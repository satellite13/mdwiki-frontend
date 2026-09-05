import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/api/graph'
import { i18n } from '@/i18n'

export interface SimNode extends d3.SimulationNodeDatum {
  slug: string
  title: string
  tags: string[]
  isCurrent: boolean
  exists: boolean
  clusterId: number
  inDegree: number
  ox?: number
  oy?: number
}

export interface NodeOrganismMotion {
  fAmp: number
  fFreqX: number
  fFreqY: number
  fPhaseX: number
  fPhaseY: number
  dAmp: number
  dFreq: number
  dPhase: number
  cAmpX: number
  cAmpY: number
  cFreqX: number
  cFreqY: number
  cPhase: number
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string
  target: SimNode | string
  bidirectional: boolean
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

function linkSlug(end: SimNode | string): string {
  return typeof end === 'string' ? end : end.slug
}

/** Сосед по исходящей связи. Для двустороннего ребра работает с обоих концов. */
export function outgoingNeighborSlug(
  link: { source: SimNode | string; target: SimNode | string; bidirectional: boolean },
  slug: string
): string | null {
  const source = linkSlug(link.source)
  const target = linkSlug(link.target)
  if (source === slug) return target
  if (link.bidirectional && target === slug) return source
  return null
}

/** Поток против направления path (source→target), когда ховер на target двустороннего ребра. */
export function linkFlowReversed(
  link: { source: SimNode | string; target: SimNode | string; bidirectional: boolean },
  slug: string
): boolean {
  return outgoingNeighborSlug(link, slug) != null && linkSlug(link.source) !== slug
}

/** Пунктир в user-space (компенсация zoom). Ширина — экранные px при non-scaling-stroke. */
export function flowStrokeForZoom(k: number): {
  dash: number
  pair: number
  gap: number
  width: number
  pattern: string
  period: number
} {
  const kk = Math.max(k, 0.05)
  const dash = 1.45 / kk
  const pair = 2.6 / kk
  const gap = 22 / kk
  const period = dash * 2 + pair + gap
  return {
    dash,
    pair,
    gap,
    width: 3.15,
    pattern: `${dash} ${pair} ${dash} ${gap}`,
    period
  }
}

export function collapseBidirectionalEdges(edges: GraphEdge[]): Array<{
  source: string
  target: string
  bidirectional: boolean
}> {
  const seen = new Map<string, { source: string; target: string; bidirectional: boolean }>()
  for (const edge of edges) {
    if (edge.source === edge.target) {
      const loopKey = `${edge.source}\0${edge.target}`
      if (!seen.has(loopKey)) {
        seen.set(loopKey, { source: edge.source, target: edge.target, bidirectional: false })
      }
      continue
    }
    const forward = `${edge.source}\0${edge.target}`
    const reverse = `${edge.target}\0${edge.source}`
    const opposite = seen.get(reverse)
    if (opposite) {
      opposite.bidirectional = true
      continue
    }
    if (!seen.has(forward)) {
      seen.set(forward, { source: edge.source, target: edge.target, bidirectional: false })
    }
  }
  return [...seen.values()]
}

export function inboundDegrees(edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const edge of edges) {
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1)
  }
  return degrees
}

/** Радиус кружка: sqrt от входящих ссылок, чтобы хабы росли, но не раздувались. */
export function nodeVisualRadius(inDegree: number, isCurrent: boolean): number {
  const scaled = 5.2 + Math.sqrt(Math.max(0, inDegree)) * 3.4
  const capped = Math.min(22, scaled)
  return isCurrent ? Math.max(capped, 10) : capped
}

function nodeRadius(d: SimNode): number {
  return nodeVisualRadius(d.inDegree, d.isCurrent)
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function unitNoise(seed: number, lane: number): number {
  return ((Math.imul(seed ^ Math.imul(lane, 0x9e3779b9), 0x85ebca6b) >>> 8) & 1023) / 1023
}

/** Детерминированные фазы/амплитуды «дыхания» узла: дрожь + медленный дрейф + общее смещение кластера. */
export function createNodeMotion(
  slug: string,
  options: { isCurrent?: boolean; clusterId?: number } = {}
): NodeOrganismMotion {
  const seed = hashString(slug)
  const clusterSeed = hashString(`cluster:${options.clusterId ?? 0}`)
  const scale = options.isCurrent ? 0.48 : 1
  return {
    fAmp: (0.9 + unitNoise(seed, 1) * 0.7) * scale,
    fFreqX: 0.7 + unitNoise(seed, 2) * 0.55,
    fFreqY: 0.62 + unitNoise(seed, 3) * 0.5,
    fPhaseX: unitNoise(seed, 4) * Math.PI * 2,
    fPhaseY: unitNoise(seed, 5) * Math.PI * 2,
    dAmp: (1.8 + unitNoise(seed, 6) * 1.4) * scale,
    dFreq: 0.085 + unitNoise(seed, 7) * 0.05,
    dPhase: unitNoise(seed, 8) * Math.PI * 2,
    cAmpX: (1.2 + unitNoise(clusterSeed, 1) * 0.8) * scale,
    cAmpY: (1.0 + unitNoise(clusterSeed, 2) * 0.7) * scale,
    cFreqX: 0.04 + unitNoise(clusterSeed, 3) * 0.02,
    cFreqY: 0.033 + unitNoise(clusterSeed, 4) * 0.018,
    cPhase: unitNoise(clusterSeed, 5) * Math.PI * 2
  }
}

export function organismOffset(motion: NodeOrganismMotion, timeSec: number): { x: number; y: number } {
  const fx = Math.sin(timeSec * motion.fFreqX + motion.fPhaseX) * motion.fAmp
  const fy = Math.cos(timeSec * motion.fFreqY + motion.fPhaseY) * motion.fAmp * 0.86
  const drift = timeSec * motion.dFreq + motion.dPhase
  const dx = Math.sin(drift) * motion.dAmp
  const dy = Math.sin(drift * 1.31 + 1.1) * motion.dAmp * 0.74
  const cx = Math.sin(timeSec * motion.cFreqX + motion.cPhase) * motion.cAmpX
  const cy = Math.cos(timeSec * motion.cFreqY + motion.cPhase) * motion.cAmpY
  return { x: fx + dx + cx, y: fy + dy + cy }
}

export function visualNodePosition(node: {
  x?: number | null
  y?: number | null
  ox?: number
  oy?: number
}): { x: number; y: number } {
  return {
    x: (node.x ?? 0) + (node.ox ?? 0),
    y: (node.y ?? 0) + (node.oy ?? 0)
  }
}

function appendHotArrow(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  id: string,
  orient: 'auto' | 'auto-start-reverse'
) {
  defs
    .append('marker')
    .attr('id', id)
    .attr('class', 'graph-hot-arrow')
    .attr('viewBox', '0 -1 4 2')
    .attr('refX', 3.6)
    .attr('refY', 0)
    .attr('markerUnits', 'strokeWidth')
    .attr('markerWidth', 3.2)
    .attr('markerHeight', 3.2)
    .attr('orient', orient)
    .append('path')
    .attr('d', 'M0,-0.72L3.8,0L0,0.72')
    .attr('fill', 'var(--color-primary, #0d9488)')
    .attr('fill-opacity', 0.52)
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function clusterTint(clusterId: number): string {
  return CLUSTER_PALETTE[clusterId % CLUSTER_PALETTE.length]!
}

function appendClusterHaloGradient(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  id: string,
  color: string
) {
  const gradient = defs
    .append('radialGradient')
    .attr('id', id)
    .attr('cx', '50%')
    .attr('cy', '50%')
    .attr('r', '50%')
  gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.34)
  gradient.append('stop').attr('offset', '38%').attr('stop-color', color).attr('stop-opacity', 0.16)
  gradient.append('stop').attr('offset', '72%').attr('stop-color', color).attr('stop-opacity', 0.05)
  gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0)
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
    const r = nodeRadius(d) + 10
    x0 = Math.min(x0, x - r)
    x1 = Math.max(x1, x + r)
    y0 = Math.min(y0, y - r)
    y1 = Math.max(y1, y + r)
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
  const { x: sx, y: sy } = visualNodePosition(s)
  const { x: tx, y: ty } = visualNodePosition(t)
  const dx = tx - sx
  const dy = ty - sy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x1: sx, y1: sy, x2: tx, y2: ty }
  const ux = dx / len
  const uy = dy / len
  const rs = nodeRadius(s) + 2.5
  const rt = nodeRadius(t) + 2.5
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

function undirectedAdj(slugs: string[], edges: GraphEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const slug of slugs) adj.set(slug, new Set())
  for (const edge of edges) {
    if (!adj.has(edge.source) || !adj.has(edge.target)) continue
    if (edge.source === edge.target) continue
    adj.get(edge.source)!.add(edge.target)
    adj.get(edge.target)!.add(edge.source)
  }
  return adj
}

/**
 * Сообщества через label propagation с голосом 1/√degree —
 * хабы не склеивают всю вики в одно облако.
 * Одиночные узлы собираются в одно «островное» облако.
 */
export function assignClusters(slugs: string[], edges: GraphEdge[]): Map<string, number> {
  const adj = undirectedAdj(slugs, edges)
  const degree = (slug: string) => adj.get(slug)?.size ?? 0
  const labels = new Map<string, string>()
  for (const slug of slugs) labels.set(slug, slug)

  const order = [...slugs].sort()
  for (let iter = 0; iter < 24; iter++) {
    let changed = false
    for (const slug of order) {
      const neighbors = adj.get(slug)
      if (!neighbors || neighbors.size === 0) continue
      const votes = new Map<string, number>()
      for (const neighbor of neighbors) {
        const weight = 1 / Math.sqrt(Math.max(degree(neighbor), 1))
        const label = labels.get(neighbor)!
        votes.set(label, (votes.get(label) ?? 0) + weight)
      }
      let best = labels.get(slug)!
      let bestVote = -1
      for (const [label, vote] of votes) {
        if (vote > bestVote + 1e-9 || (Math.abs(vote - bestVote) <= 1e-9 && label < best)) {
          best = label
          bestVote = vote
        }
      }
      if (best !== labels.get(slug)) {
        labels.set(slug, best)
        changed = true
      }
    }
    if (!changed) break
  }

  const groups = new Map<string, string[]>()
  for (const slug of slugs) {
    const label = labels.get(slug)!
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(slug)
  }

  const multi: string[][] = []
  const singles: string[] = []
  for (const members of groups.values()) {
    if (members.length >= 2) multi.push(members)
    else singles.push(members[0]!)
  }
  multi.sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!))

  const result = new Map<string, number>()
  let clusterId = 0
  for (const members of multi) {
    for (const slug of members) result.set(slug, clusterId)
    clusterId++
  }
  if (singles.length) {
    for (const slug of singles) result.set(slug, clusterId)
  }
  return result
}

function layoutClusterCenters(count: number, width: number, height: number): { x: number; y: number }[] {
  if (count <= 0) return []
  const cx = width / 2
  const cy = height / 2
  if (count === 1) return [{ x: cx, y: cy }]
  const radius = Math.min(width, height) * (count > 6 ? 0.48 : 0.42)
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
    const xs = members.map((n) => visualNodePosition(n).x)
    const ys = members.map((n) => visualNodePosition(n).y)
    const cx = d3.mean(xs) ?? 0
    const cy = d3.mean(ys) ?? 0
    const spreadX = d3.max(xs.map((x) => Math.abs(x - cx))) ?? 0
    const spreadY = d3.max(ys.map((y) => Math.abs(y - cy))) ?? 0
    const rx = Math.max(52, spreadX + 56)
    const ry = Math.max(46, spreadY + 50)
    halos.push({ clusterId, cx, cy, rx, ry })
  }
  return halos
}

function buildSimNodes(
  nodes: GraphNode[],
  clusterBySlug: Map<string, number>,
  inDegreeBySlug: Map<string, number>,
  centers: { x: number; y: number }[],
  width: number,
  height: number,
  _variant: 'page' | 'wiki'
): SimNode[] {
  const cx = width / 2
  const cy = height / 2
  const others = nodes.filter((n) => !n.isCurrent)
  const ring = Math.min(width, height) * 0.3

  return nodes.map((n, idx) => {
    const clusterId = clusterBySlug.get(n.slug) ?? 0
    const inDegree = inDegreeBySlug.get(n.slug) ?? 0
    const center = centers[clusterId] ?? { x: cx, y: cy }

    if (n.isCurrent) {
      return { ...n, clusterId, inDegree, x: cx, y: cy, fx: cx, fy: cy }
    }

    if (centers.length > 1) {
      const angle = (idx * 2.399963) % (2 * Math.PI)
      const spread = 28 + (idx % 7) * 10
      return {
        ...n,
        clusterId,
        inDegree,
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
      inDegree,
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
  const simLinks: SimLink[] = collapseBidirectionalEdges(alignedEdges).map((e) => ({
    source: e.source,
    target: e.target,
    bidirectional: e.bidirectional
  }))

  const slugs = nodes.map((n) => n.slug)
  const inDegreeBySlug = inboundDegrees(alignedEdges)
  const clusterBySlug = assignClusters(slugs, alignedEdges)
  const clusterCount = clusterBySlug.size ? Math.max(...clusterBySlug.values()) + 1 : 1
  const clusterCenters = layoutClusterCenters(clusterCount, width, height)
  const simNodes = buildSimNodes(nodes, clusterBySlug, inDegreeBySlug, clusterCenters, width, height, variant)
  const showClusters = clusterCount > 1

  const intraDist = wiki ? 56 + Math.min(width, height) * 0.04 : 72 + Math.min(width, height) * 0.06
  const interDist = 130 + Math.min(width, height) * (wiki ? 0.12 : 0.1)
  const clusterForce = forceCluster(clusterCenters).strength(showClusters ? (wiki ? 0.22 : 0.18) : 0.05)

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.slug)
        .distance((d) => {
          const s = d.source as SimNode
          const t = d.target as SimNode
          if (typeof s === 'string' || typeof t === 'string') return intraDist
          return s.clusterId === t.clusterId ? intraDist : interDist
        })
        .strength((d) => {
          const s = d.source as SimNode
          const t = d.target as SimNode
          if (typeof s === 'string' || typeof t === 'string') return wiki ? 0.22 : 0.45
          return s.clusterId === t.clusterId ? (wiki ? 0.42 : 0.48) : 0.07
        })
    )
    .force(
      'charge',
      d3
        .forceManyBody<SimNode>()
        .strength((d) =>
          wiki ? -(90 + d.inDegree * 16 + Math.min(nodes.length, 90) * 2.2) : -420
        )
        .distanceMax(wiki ? 520 : 420)
    )
    .force('center', d3.forceCenter(width / 2, height / 2).strength(wiki ? 0.012 : 0.04))
    .force(
      'collision',
      d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + (wiki ? 14 : 18)).iterations(2)
    )
    .force('cluster', clusterForce)
    .velocityDecay(wiki ? 0.58 : 0.56)

  const rootG = svg.append('g')

  let zoomK = 1
  const flowAnims = new Map<SVGPathElement, Animation>()
  function stopFlowLights() {
    for (const anim of flowAnims.values()) anim.cancel()
    flowAnims.clear()
  }
  function startFlowLights() {
    stopFlowLights()
    if (prefersReducedMotion()) return
    const { period } = flowStrokeForZoom(zoomK)
    flow.filter('.is-hot').each(function () {
      const reverse = this.classList.contains('is-flow-reverse')
      const anim = this.animate(
        [
          { strokeDashoffset: reverse ? -period : 0 },
          { strokeDashoffset: reverse ? 0 : -period }
        ],
        { duration: 1600, iterations: Infinity, easing: 'linear' }
      )
      flowAnims.set(this, anim)
    })
  }
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.04, 4])
    .on('zoom', (event) => {
      rootG.attr('transform', event.transform)
      zoomK = event.transform.k
      if (svgEl.classList.contains('is-focusing')) startFlowLights()
    })
  svg.call(zoom)

  const defs = svg.append('defs')

  const safeKey = markerKey.replace(/[^a-zA-Z0-9_-]/g, '_')
  const hotArrowEndId = `hot-arrow-${safeKey}`
  const hotArrowStartId = `hot-arrow-start-${safeKey}`
  appendHotArrow(defs, hotArrowEndId, 'auto')
  appendHotArrow(defs, hotArrowStartId, 'auto-start-reverse')

  const glowId = `node-glow-${safeKey}`
  const glow = defs.append('filter').attr('id', glowId).attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
  glow.append('feGaussianBlur').attr('stdDeviation', '2.2').attr('result', 'blur')
  const merge = glow.append('feMerge')
  merge.append('feMergeNode').attr('in', 'blur')
  merge.append('feMergeNode').attr('in', 'SourceGraphic')

  const haloGradientId = (clusterId: number) => `cluster-halo-${safeKey}-${clusterId}`
  for (let clusterId = 0; clusterId < clusterCount; clusterId++) {
    appendClusterHaloGradient(defs, haloGradientId(clusterId), clusterTint(clusterId))
  }

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
    .attr('fill', (d) => `url(#${haloGradientId(d.clusterId)})`)
    .attr('fill-opacity', showClusters ? 1 : 0)
    .attr('stroke', 'none')
    .style('pointer-events', 'none')

  const link = linkRoot
    .selectAll<SVGPathElement, SimLink>('path.graph-link')
    .data(simLinks)
    .join('path')
    .attr('class', 'graph-link')
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-text-faint, #8b949e)')
    .attr('stroke-width', (d) => {
      const s = d.source as SimNode
      const t = d.target as SimNode
      if (typeof s === 'string' || typeof t === 'string') return 0.4
      return s.clusterId === t.clusterId ? 0.35 : 1.05
    })
    .attr('stroke-opacity', (d) => {
      const s = d.source as SimNode
      const t = d.target as SimNode
      if (typeof s === 'string' || typeof t === 'string') return 0.28
      return s.clusterId === t.clusterId ? 0.28 : 0.36
    })
    .style('pointer-events', 'none')

  const flow = linkRoot
    .selectAll<SVGPathElement, SimLink>('path.graph-link-flow')
    .data(simLinks)
    .join('path')
    .attr('class', 'graph-link-flow')
    .attr('fill', 'none')
    .style('pointer-events', 'none')

  const node = nodeRoot
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .attr('class', (d) => (d.isCurrent ? 'graph-node graph-node--current' : 'graph-node'))
    .attr('data-slug', (d) => d.slug)
    .style('cursor', 'pointer')
    .on('pointerenter', function (_event, d) {
      const neighbors = new Set(
        simLinks.map((l) => outgoingNeighborSlug(l, d.slug)).filter((slug): slug is string => slug != null)
      )
      svg.classed('is-focusing', true)
      d3.select(this).classed('is-hovered', true).raise()
      link
        .classed('is-hot', (l) => outgoingNeighborSlug(l, d.slug) != null)
        .classed('is-dimmed', (l) => outgoingNeighborSlug(l, d.slug) == null)
        .attr('marker-end', (l) =>
          outgoingNeighborSlug(l, d.slug) != null && !linkFlowReversed(l, d.slug)
            ? `url(#${hotArrowEndId})`
            : null
        )
        .attr('marker-start', (l) =>
          linkFlowReversed(l, d.slug) ? `url(#${hotArrowStartId})` : null
        )
      flow
        .classed('is-hot', (l) => outgoingNeighborSlug(l, d.slug) != null)
        .classed('is-flow-reverse', (l) => linkFlowReversed(l, d.slug))
      link.filter((l) => outgoingNeighborSlug(l, d.slug) != null).raise()
      flow.filter((l) => outgoingNeighborSlug(l, d.slug) != null).raise()
      node
        .classed('is-neighbor', (n) => neighbors.has(n.slug))
        .classed('is-dimmed', (n) => n.slug !== d.slug && !neighbors.has(n.slug))
      node.filter((n) => neighbors.has(n.slug)).raise()
      d3.select(this).raise()
      startFlowLights()
    })
    .on('pointerleave', function () {
      svg.classed('is-focusing', false)
      d3.select(this).classed('is-hovered', false)
      link
        .classed('is-hot', false)
        .classed('is-dimmed', false)
        .attr('marker-end', null)
        .attr('marker-start', null)
      flow.classed('is-hot', false).classed('is-flow-reverse', false)
      node.classed('is-neighbor', false).classed('is-dimmed', false)
      stopFlowLights()
    })
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
    .append('circle')
    .attr('class', 'graph-node__hit')
    .attr('r', (d) => nodeRadius(d) + 10)
    .attr('fill', 'transparent')

  node
    .filter((d) => d.isCurrent)
    .append('circle')
    .attr('class', 'graph-node__pulse')
    .attr('r', (d) => nodeRadius(d) + 6)
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
      if (showClusters) return clusterTint(d.clusterId)
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
    .attr('class', 'graph-node__label')
    .text((d) => (d.title.length > 28 ? d.title.slice(0, 26) + '\u2026' : d.title))
    .attr('x', 0)
    .attr('y', (d) => nodeRadius(d) + (d.isCurrent ? 15 : 13))
    .attr('text-anchor', 'middle')
    .attr('font-size', (d) => (d.isCurrent ? '11px' : '10px'))
    .attr('font-weight', (d) => (d.isCurrent ? '600' : '500'))
    .attr('letter-spacing', '0.01em')
    .attr('fill', 'var(--color-text, #24292f)')
    .attr('paint-order', 'stroke fill')
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 3)
    .attr('stroke-linejoin', 'round')
    .style('pointer-events', 'none')

  node.append('title').text((d) => {
    const incoming = i18n.global.t('graph.incoming', { count: d.inDegree })
    if (!d.tags.length) return `${d.title}\n${incoming}`
    return `${d.title}\n${incoming}\n${i18n.global.t('search.tagsLabel')} ${d.tags.map((tag) => '#' + tag).join(', ')}`
  })

  const motions = new Map(
    simNodes.map((n) => [n.slug, createNodeMotion(n.slug, { isCurrent: n.isCurrent, clusterId: n.clusterId })])
  )
  const startedAt = performance.now()
  let rafId = 0
  let stopped = false

  function applyOrganism(now: number) {
    const reduce = prefersReducedMotion()
    const t = (now - startedAt) / 1000
    for (const n of simNodes) {
      const dragging = n.fx != null && n.fy != null && !n.isCurrent
      if (reduce || dragging) {
        n.ox = 0
        n.oy = 0
        continue
      }
      const off = organismOffset(motions.get(n.slug)!, t)
      n.ox = off.x
      n.oy = off.y
    }
  }

  function paint() {
    const pathD = (d: SimLink) => {
      if (typeof d.source === 'string' || typeof d.target === 'string') return ''
      return linkCurvePath(d.source as SimNode, d.target as SimNode)
    }
    const stroke = flowStrokeForZoom(zoomK)
    link.attr('d', pathD)
    flow.attr('d', pathD).attr('stroke-dasharray', stroke.pattern)
    node.attr('transform', (d) => {
      const { x, y } = visualNodePosition(d)
      return `translate(${x},${y})`
    })

    if (showClusters) {
      const haloData = computeClusterHalos(simNodes)
      halos.data(haloData).attr('cx', (d) => d.cx).attr('cy', (d) => d.cy).attr('rx', (d) => d.rx).attr('ry', (d) => d.ry)
    }
  }

  simulation.on('tick', paint)

  simulation.alpha(1).restart()
  const tickCap = wiki ? 700 : 240
  for (let i = 0; i < tickCap && simulation.alpha() > 0.02; i++) {
    simulation.tick()
  }

  const fitted = fitBoundsTransform(simNodes, width, height)
  svg.call(zoom.transform, fitted)
  zoomK = fitted.k
  paint()

  if (wiki) {
    simulation.alpha(0)
  } else {
    simulation.alpha(0.3).restart()
  }

  function loop(now: number) {
    if (stopped) return
    applyOrganism(now)
    paint()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  return {
    stop() {
      stopped = true
      stopFlowLights()
      if (rafId) cancelAnimationFrame(rafId)
      simulation.stop()
    }
  }
}
