<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getPageGraph, getWikiGraph } from '@/api/graph'
import type { GraphNode, GraphEdge } from '@/api/graph'
import { renderGraph, type GraphRenderHandle } from './graphRenderer'

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
let renderHandle: GraphRenderHandle | null = null
let resizeObserver: ResizeObserver | null = null
let lastNodes: GraphNode[] = []
let lastEdges: GraphEdge[] = []

function currentMarkerKey(): string {
  return props.variant === 'wiki'
    ? `wiki-${props.highlightSlug ?? 'all'}`
    : `${props.slug}-${depth.value}`
}

function draw() {
  if (!svgRef.value) return
  renderHandle?.stop()
  renderHandle = renderGraph({
    svg: svgRef.value,
    variant: props.variant,
    nodes: lastNodes,
    edges: lastEdges,
    markerKey: currentMarkerKey(),
    onNodeClick: (slug) => router.push(`/page/${slug}`)
  })
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
    // Сначала убираем оверлей, чтобы flex отдал svg высоту (иначе clientHeight = 0 → NaN в d3).
    loading.value = false
    await nextTick()
    await nextTick()
    if (props.variant === 'wiki') {
      requestAnimationFrame(() => requestAnimationFrame(draw))
    } else {
      draw()
    }
  } catch (e) {
    console.error('Failed to load graph:', e)
    lastNodes = []
    lastEdges = []
    loading.value = false
  }
}

function setDepth(d: number) {
  depth.value = d
  loadGraph()
}

function bindResizeObserver() {
  resizeObserver?.disconnect()
  if (typeof ResizeObserver === 'undefined' || !canvasRef.value) return
  let timer: ReturnType<typeof setTimeout> | null = null
  resizeObserver = new ResizeObserver(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (lastNodes.length && !loading.value) draw()
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
  renderHandle?.stop()
  renderHandle = null
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

@media (max-width: 767px) {
  .graph-toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px;
  }

  .graph-label {
    flex: 1 1 100%;
    font-size: 12px;
  }

  .depth-btn {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }
}
</style>
