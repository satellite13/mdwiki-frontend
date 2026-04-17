import client from './client'

export interface GraphNode {
  slug: string
  title: string
  tags: string[]
  isCurrent: boolean
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

function readEdgeEndpoint(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

/** Парсинг рёбер: разные версии Jackson/Kotlin могут отдавать Source/Target и т.п. */
function normalizeEdges(raw: unknown): GraphEdge[] {
  if (!Array.isArray(raw)) return []
  const out: GraphEdge[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const source = readEdgeEndpoint(o, 'source', 'Source', 'SOURCE', 'from', 'From')
    const target = readEdgeEndpoint(o, 'target', 'Target', 'TARGET', 'to', 'To')
    if (source && target) out.push({ source, target })
  }
  return out
}

/** Jackson + Kotlin часто отдаёт boolean как `current` вместо `isCurrent`. */
function normalizeGraphResponse(raw: GraphResponse): GraphResponse {
  const rawAny = raw as GraphResponse & { edges?: unknown }
  return {
    nodes: (raw.nodes ?? []).map((n) => ({
      ...n,
      isCurrent: n.isCurrent ?? (n as { current?: boolean }).current ?? false
    })),
    edges: normalizeEdges(rawAny.edges ?? raw.edges)
  }
}

export async function getPageGraph(slug: string, depth: number = 1) {
  const res = await client.get<GraphResponse>(`/pages/${slug}/graph`, { params: { depth } })
  return { ...res, data: normalizeGraphResponse(res.data) }
}

/** Все страницы и связи вики. `highlight` — подсветить узел (query `highlight`). */
export async function getWikiGraph(highlight?: string) {
  const res = await client.get<GraphResponse>('/graph/wiki', {
    params: highlight ? { highlight } : undefined
  })
  return { ...res, data: normalizeGraphResponse(res.data) }
}
