<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'
import { getPageGraph, type GraphNode, type GraphEdge } from '@/api/graph'
import { useRouter } from 'vue-router'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const depth = ref(1)
const loading = ref(false)
const svgRef = ref<SVGSVGElement | null>(null)
let simulation: d3.Simulation<any, any> | null = null

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

async function loadGraph() {
  if (!props.slug) return
  loading.value = true
  try {
    const { data } = await getPageGraph(props.slug, depth.value)
    await nextTick()
    renderGraph(data.nodes, data.edges)
  } catch (e) {
    console.error('Failed to load graph:', e)
  } finally {
    loading.value = false
  }
}

function renderGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  if (!svgRef.value) return
  const width = svgRef.value.clientWidth
  const height = svgRef.value.clientHeight

  const simNodes: SimNode[] = nodes.map(n => ({
    ...n,
    x: n.isCurrent ? width / 2 : undefined,
    y: n.isCurrent ? height / 2 : undefined,
    fx: n.isCurrent ? width / 2 : undefined,
    fy: n.isCurrent ? height / 2 : undefined
  }))

  const simLinks: SimLink[] = edges.map(e => ({ source: e.source, target: e.target }))

  // Stop old simulation
  if (simulation) simulation.stop()

  simulation = d3.forceSimulation<SimNode>(simNodes)
    .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id(d => d.slug).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30))

  const g = svg.append('g')

  // Zoom
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => g.attr('transform', event.transform))
  svg.call(zoom as any)

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'var(--color-text-faint, #999)')

  // Links
  const link = g.append('g')
    .selectAll('line')
    .data(simLinks)
    .join('line')
    .attr('stroke', 'var(--color-border, #ddd)')
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)')

  // Nodes
  const node = g.append('g')
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      router.push(`/page/${d.slug}`)
    })
    .call(d3.drag<SVGGElement, SimNode>()
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

  // Node circles
  node.append('circle')
    .attr('r', d => d.isCurrent ? 12 : 8)
    .attr('fill', d => d.isCurrent ? 'var(--color-primary, #0d9488)' : 'var(--color-text-muted, #999)')
    .attr('stroke', 'var(--color-bg, #fff)')
    .attr('stroke-width', 2)

  // Node labels
  node.append('text')
    .text(d => d.title.length > 20 ? d.title.slice(0, 18) + '\u2026' : d.title)
    .attr('x', 0)
    .attr('y', d => d.isCurrent ? -18 : -14)
    .attr('text-anchor', 'middle')
    .attr('font-size', d => d.isCurrent ? '12px' : '10px')
    .attr('font-weight', d => d.isCurrent ? '600' : '400')
    .attr('fill', 'var(--color-text, #333)')

  // Tooltip on hover
  node.append('title')
    .text(d => `${d.title}${d.tags.length ? '\nTags: ' + d.tags.map(t => '#' + t).join(', ') : ''}`)

  // Tick
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)

    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
  })
}

function setDepth(d: number) {
  depth.value = d
  loadGraph()
}

onMounted(loadGraph)
watch(() => props.slug, loadGraph)

onBeforeUnmount(() => {
  if (simulation) simulation.stop()
})
</script>

<template>
  <div class="graph-panel">
    <div class="graph-toolbar">
      <span class="graph-label">Graph</span>
      <div class="depth-controls">
        <button v-for="d in [1, 2, 3]" :key="d"
          :class="['depth-btn', { active: depth === d }]"
          @click="setDepth(d)">
          {{ d }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="graph-loading">Loading graph...</div>
    <svg ref="svgRef" class="graph-svg"></svg>
  </div>
</template>

<style scoped>
.graph-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-top: 1px solid var(--color-border);
}

.graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
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

.graph-loading {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
}

.graph-svg {
  flex: 1;
  width: 100%;
  min-height: 250px;
}
</style>
