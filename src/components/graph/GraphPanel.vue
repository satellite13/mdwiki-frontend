<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getPageGraph, getWikiGraph } from '@/api/graph'
import type { GraphNode, GraphEdge } from '@/api/graph'
import { renderGraph, type GraphRenderHandle } from './graphRenderer'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

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
      <div class="graph-toolbar__left">
        <span class="graph-label">{{ variant === 'wiki' ? 'Wiki graph' : 'Page graph' }}</span>
        <span v-if="variant === 'wiki' && lastNodes.length" class="graph-meta">{{ lastNodes.length }} nodes</span>
      </div>
      <div v-if="variant === 'page'" class="depth-controls">
        <span class="depth-label">Depth</span>
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
      <div v-if="loading" class="graph-loading"><SkeletonLoader width="100%" height="100%" variant="block" /></div>
      <svg ref="svgRef" class="graph-svg" aria-hidden="true" />
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
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg-secondary) 88%, transparent);
  backdrop-filter: blur(6px);
  flex-shrink: 0;
}

.graph-toolbar__left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.graph-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.graph-meta {
  font-size: 11px;
  color: var(--color-text-faint);
  font-variant-numeric: tabular-nums;
}

.depth-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.depth-label {
  font-size: 11px;
  color: var(--color-text-faint);
  margin-right: 2px;
}

.depth-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.depth-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  color: var(--color-text);
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
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 70%),
    radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 0);
  background-size: auto, 22px 22px;
  background-color: var(--color-bg);
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
  background: color-mix(in srgb, var(--color-bg) 94%, transparent);
  backdrop-filter: blur(2px);
}

.graph-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.graph-svg :deep(.graph-node:hover .graph-node__dot) {
  stroke: var(--color-primary);
  stroke-width: 2;
}

@media (max-width: 767px) {
  .graph-toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px;
  }

  .graph-toolbar__left {
    flex: 1 1 100%;
  }

  .graph-label {
    font-size: 12px;
  }

  .depth-btn {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }
}
</style>
