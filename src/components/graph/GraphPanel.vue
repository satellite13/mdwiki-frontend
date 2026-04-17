<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'
import { getPageGraph, getWikiGraph, type GraphNode, type GraphEdge } from '@/api/graph'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'page' | 'wiki'
    slug?: string
    highlightSlug?: string | null
  }>(),
  { variant: 'page', slug: '', highlightSlug: null }
)

const router = useRouter()
const depth = ref(1)
const loading = ref(false)
const svgRef = ref<SVGSVGElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<any, any> | null = null
let resizeObserver: ResizeObserver | null = null
/** Последние данные для перерисовки при смене размера панели */
let lastNodes: GraphNode[] = []
let lastEdges: GraphEdge[] = []

interface SimNode extends d3.SimulationNodeDatum {
  slug: string
  title: string
  tags: string[]
  isCurrent: boolean
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string
  target: SimNode | string
}

function measureSvg(): { width: number; height: number } {
  const el = svgRef.value
  if (!el) return { width: 320, height: 240 }
  const r = el.getBoundingClientRect()
  const w = Math.max(120, Math.floor(r.width || el.clientWidth))
  const h = Math.max(120, Math.floor(r.height || el.clientHeight))
  return { width: w, height: h }
}

async function loadGraph() {
  if (props.variant === 'page' && !props.slug) return
  loading.value = true
  try {
    const { data } =
      props.variant === 'wiki'
        ? await getWikiGraph(props.highlightSlug ?? undefined)
        : await getPageGraph(props.slug!, depth.value)
    lastNodes = data.nodes
    lastEdges = data.edges
    // Сначала убираем оверлей загрузки, чтобы flex отдал svg реальную высоту (иначе clientHeight = 0 → NaN в d3)
    loading.value = false
    await nextTick()
    await nextTick()
    // После снятия оверлея main/graph-panel получают высоту — два rAF дают корректный measureSvg().
    const run = () => renderGraph(lastNodes, lastEdges)
    if (props.variant === 'wiki') {
      requestAnimationFrame(() => requestAnimationFrame(run))
    } else {
      run()
    }
  } catch (e) {
    console.error('Failed to load graph:', e)
    lastNodes = []
    lastEdges = []
    loading.value = false
  }
}

/** Совпадение slug на рёбрах и в узлах (регистр и возможные отличия API). */
function nodeRadius(d: SimNode): number {
  return d.isCurrent ? 14 : 9
}

/** Подобрать масштаб/сдвиг так, чтобы все узлы (и подписи) попали в видимую область. */
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
    const below = nodeRadius(d) + 18
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
  const pad = 32
  if (dx < 6 && dy < 6) {
    return d3.zoomIdentity.translate(w / 2 - cx, h / 2 - cy)
  }
  const sx = (w - 2 * pad) / dx
  const sy = (h - 2 * pad) / dy
  const k = Math.max(0.06, Math.min(sx, sy, 3.2) * 0.92)
  return d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-cx, -cy)
}

/** Концы отрезка: от края круга до края круга, чтобы линия и стрелка не рисовались поверх узла */
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
  const rs = nodeRadius(s) + 3
  const rt = nodeRadius(t) + 10
  return {
    x1: sx + ux * rs,
    y1: sy + uy * rs,
    x2: tx - ux * rt,
    y2: ty - uy * rt
  }
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

function renderGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const wiki = props.variant === 'wiki'
  const { width, height } = measureSvg()
  const simLinks: SimLink[] = alignEdgesToNodes(nodes, edges).map((e) => ({
    source: e.source,
    target: e.target
  }))

  const cx = width / 2
  const cy = height / 2
  const others = nodes.filter((n) => !n.isCurrent)
  const ring = Math.min(width, height) * 0.32
  const scatter = wiki && nodes.length > 18
  const margin = 40
  const simNodes: SimNode[] = nodes.map((n, idx) => {
    if (n.isCurrent) {
      return {
        ...n,
        x: cx,
        y: cy,
        fx: cx,
        fy: cy
      }
    }
    if (scatter) {
      const rw = Math.max(80, width - 2 * margin)
      const rh = Math.max(80, height - 2 * margin)
      return {
        ...n,
        x: margin + Math.random() * rw,
        y: margin + Math.random() * rh
      }
    }
    const k = others.indexOf(n)
    const nOthers = Math.max(others.length, 1)
    const angle = (2 * Math.PI * k) / nOthers - Math.PI / 2
    const jitter = 0.85 + (idx % 5) * 0.03
    return {
      ...n,
      x: cx + Math.cos(angle) * ring * jitter,
      y: cy + Math.sin(angle) * ring * jitter
    }
  })

  if (simulation) simulation.stop()

  const linkDist = wiki ? 48 + Math.min(width, height) * 0.04 : 90 + Math.min(width, height) * 0.08
  const charge = wiki ? -Math.min(1200, 180 + nodes.length * 6) : -520
  const collideR = wiki ? Math.max(14, Math.min(28, 320 / Math.sqrt(Math.max(nodes.length, 1)))) : 30
  simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.slug)
        .distance(linkDist)
        .strength(wiki ? 0.35 : 0.55)
    )
    .force('charge', d3.forceManyBody().strength(charge))
    .force('center', d3.forceCenter(cx, cy).strength(wiki ? 0.04 : 0.12))
    .force('collision', d3.forceCollide<SimNode>().radius((d) => (d.isCurrent ? 36 : collideR)))
    .velocityDecay(wiki ? 0.62 : 0.55)

  const rootG = svg.append('g')

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.04, 4])
    .on('zoom', (event) => rootG.attr('transform', event.transform))
  svg.call(zoom as any)

  const markerKey =
    props.variant === 'wiki'
      ? `wiki-${props.highlightSlug ?? 'all'}`
      : `${props.slug}-${depth.value}`
  const markerId = `arrowhead-${markerKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  svg
    .append('defs')
    .append('marker')
    .attr('id', markerId)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 9)
    .attr('refY', 0)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#94a3b8')

  // Сначала рёбра, потом узлы — в SVG последующие элементы рисуются поверх
  const linkRoot = rootG.append('g').attr('class', 'graph-links')
  const nodeRoot = rootG.append('g').attr('class', 'graph-nodes')

  const node = nodeRoot
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      router.push(`/page/${d.slug}`)
    })
    .call(
      d3
        .drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation!.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation!.alphaTarget(0)
          if (!d.isCurrent) {
            d.fx = null
            d.fy = null
          }
        })
    )

  const link = linkRoot
    .selectAll('line')
    .data(simLinks)
    .join('line')
    .style('stroke', '#94a3b8')
    .attr('stroke-width', 1.75)
    .attr('stroke-opacity', 0.85)
    .attr('marker-end', `url(#${markerId})`)
    .style('pointer-events', 'none')

  node
    .append('circle')
    .attr('r', (d) => nodeRadius(d))
    .attr('fill', (d) => (d.isCurrent ? 'var(--color-primary, #0d9488)' : 'var(--color-text-muted, #999)'))
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 2)

  node
    .append('text')
    .text((d) => (d.title.length > 20 ? d.title.slice(0, 18) + '\u2026' : d.title))
    .attr('x', 0)
    .attr('y', (d) => nodeRadius(d) + (d.isCurrent ? 15 : 13))
    .attr('text-anchor', 'middle')
    .attr('font-size', (d) => (d.isCurrent ? '12px' : '10px'))
    .attr('font-weight', (d) => (d.isCurrent ? '600' : '400'))
    .attr('fill', 'var(--color-text, #333)')
    .attr('paint-order', 'stroke fill')
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 3)
    .attr('stroke-linejoin', 'round')

  node.append('title').text((d) => `${d.title}${d.tags.length ? '\nTags: ' + d.tags.map((t) => '#' + t).join(', ') : ''}`)

  simulation.on('tick', () => {
    link.each(function (d: unknown) {
      const datum = d as SimLink
      if (typeof datum.source === 'string' || typeof datum.target === 'string') return
      const s = datum.source as SimNode
      const t = datum.target as SimNode
      const { x1, y1, x2, y2 } = linkLineCoords(s, t)
      d3.select(this).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
    })

    node.attr('transform', (d: any) => `translate(${d.x ?? 0},${d.y ?? 0})`)
  })

  simulation.alpha(1).restart()
  const tickCap = wiki ? 650 : 220
  for (let i = 0; i < tickCap && simulation.alpha() > 0.02; i++) {
    simulation.tick()
  }

  svg.call(zoom.transform as any, fitBoundsTransform(simNodes, width, height))

  if (wiki) {
    simulation.alpha(0)
  } else {
    simulation.alpha(0.35).restart()
  }
}

function setDepth(d: number) {
  depth.value = d
  loadGraph()
}

function bindResizeObserver() {
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined' || !canvasRef.value) return
  let t: ReturnType<typeof setTimeout> | null = null
  resizeObserver = new ResizeObserver(() => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      if (lastNodes.length && !loading.value) renderGraph(lastNodes, lastEdges)
    }, 80)
  })
  resizeObserver.observe(canvasRef.value)
}

onMounted(() => {
  bindResizeObserver()
  loadGraph()
})

watch(
  () =>
    props.variant === 'wiki'
      ? `${props.variant}:${props.highlightSlug ?? ''}`
      : `${props.variant}:${props.slug}:${depth.value}`,
  () => loadGraph()
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (simulation) simulation.stop()
})
</script>

<template>
  <div class="graph-panel" :class="{ 'graph-panel--wiki': variant === 'wiki' }">
    <div class="graph-toolbar">
      <span class="graph-label">{{ variant === 'wiki' ? 'Wiki graph' : 'Page graph' }}</span>
      <div v-if="variant === 'page'" class="depth-controls">
        <button
          v-for="d in [1, 2, 3]"
          :key="d"
          type="button"
          :class="['depth-btn', { active: depth === d }]"
          @click="setDepth(d)"
        >
          {{ d }}
        </button>
      </div>
    </div>
    <div ref="canvasRef" class="graph-canvas">
      <div v-if="loading" class="graph-loading">Loading graph...</div>
      <svg ref="svgRef" class="graph-svg" />
    </div>
  </div>
</template>

<style scoped>
.graph-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  border-top: 1px solid var(--color-border);
}

.graph-panel--wiki {
  border-top: none;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

.graph-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.depth-controls {
  display: flex;
  gap: 4px;
}

.depth-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 11px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.depth-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.graph-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
}

.graph-loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--color-text-muted);
  background: var(--color-bg);
  opacity: 0.92;
}

.graph-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
