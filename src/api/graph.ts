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

export function getPageGraph(slug: string, depth: number = 1) {
  return client.get<GraphResponse>(`/pages/${slug}/graph`, { params: { depth } })
}
