type StructurizrNode = {
  id: string
  label: string
}

type StructurizrEdge = {
  source: string
  target: string
  label: string
}

type ParsedStructurizr = {
  nodes: StructurizrNode[]
  edges: StructurizrEdge[]
}

const ASSIGNMENT_DECLARATION =
  /^\s*([A-Za-z_][\w.]*)\s*=\s*(person|softwareSystem|container|component)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*$/i
const AS_DECLARATION =
  /^\s*(person|softwareSystem|container|component)\s+"([^"]+)"(?:\s+"([^"]+)")?\s+as\s+([A-Za-z_][\w.]*)\s*$/i
const RELATION =
  /^\s*([A-Za-z_][\w.]*)\s*->\s*([A-Za-z_][\w.]*)(?:\s+"([^"]*)")?\s*$/

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeLine(line: string): string {
  return line.replace(/\/\/.*$/g, '').trim()
}

export function parseStructurizrDsl(source: string): ParsedStructurizr {
  const nodesById = new Map<string, StructurizrNode>()
  const edges: StructurizrEdge[] = []
  let autoIndex = 1

  const lines = source
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)

  for (const line of lines) {
    const assignmentMatch = line.match(ASSIGNMENT_DECLARATION)
    if (assignmentMatch) {
      const [, id, , name] = assignmentMatch
      nodesById.set(id, { id, label: name.trim() })
      continue
    }

    const asMatch = line.match(AS_DECLARATION)
    if (asMatch) {
      const [, , name, , id] = asMatch
      nodesById.set(id, { id, label: name.trim() })
      continue
    }

    const relationMatch = line.match(RELATION)
    if (relationMatch) {
      const [, sourceId, targetId, relationLabel = ''] = relationMatch
      edges.push({ source: sourceId, target: targetId, label: relationLabel.trim() })
      if (!nodesById.has(sourceId)) {
        nodesById.set(sourceId, { id: sourceId, label: sourceId })
      }
      if (!nodesById.has(targetId)) {
        nodesById.set(targetId, { id: targetId, label: targetId })
      }
      continue
    }

    const simpleElementMatch = line.match(/^\s*(person|softwareSystem|container|component)\s+"([^"]+)"/i)
    if (simpleElementMatch) {
      const [, , name] = simpleElementMatch
      const id = `element_${autoIndex++}`
      nodesById.set(id, { id, label: name.trim() })
    }
  }

  return { nodes: Array.from(nodesById.values()), edges }
}

export function renderStructurizrSvg(source: string, isDark: boolean): string {
  const { nodes, edges } = parseStructurizrDsl(source)
  if (!nodes.length) throw new Error('Empty Structurizr diagram')

  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(nodes.length))))
  const nodeWidth = 220
  const nodeHeight = 88
  const gapX = 56
  const gapY = 52
  const padding = 24

  const rows = Math.ceil(nodes.length / columns)
  const width = padding * 2 + columns * nodeWidth + Math.max(0, columns - 1) * gapX
  const height = padding * 2 + rows * nodeHeight + Math.max(0, rows - 1) * gapY
  const textColor = isDark ? '#e5edf7' : '#1f2d3d'
  const nodeFill = isDark ? '#1f2a3c' : '#f7fbff'
  const nodeStroke = isDark ? '#516782' : '#7fa6d6'
  const edgeStroke = isDark ? '#8ba8c9' : '#4a78ad'
  const labelFill = isDark ? '#0e1622' : '#ffffff'
  const labelStroke = isDark ? '#425774' : '#bed2eb'

  const positions = new Map<string, { x: number; y: number; cx: number; cy: number }>()
  nodes.forEach((node, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = padding + column * (nodeWidth + gapX)
    const y = padding + row * (nodeHeight + gapY)
    positions.set(node.id, { x, y, cx: x + nodeWidth / 2, cy: y + nodeHeight / 2 })
  })

  const edgeSvg = edges.map((edge) => {
    const sourcePos = positions.get(edge.source)
    const targetPos = positions.get(edge.target)
    if (!sourcePos || !targetPos) return ''

    const x1 = sourcePos.cx
    const y1 = sourcePos.cy
    const x2 = targetPos.cx
    const y2 = targetPos.cy
    const lx = (x1 + x2) / 2
    const ly = (y1 + y2) / 2 - 8
    const label = edge.label ? escapeXml(edge.label) : ''

    return [
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${edgeStroke}" stroke-width="1.8" marker-end="url(#structurizr-arrow)" />`,
      label
        ? `<rect x="${lx - Math.min(72, label.length * 3.6)}" y="${ly - 11}" rx="6" ry="6" width="${Math.max(42, Math.min(144, label.length * 7.2 + 12))}" height="20" fill="${labelFill}" stroke="${labelStroke}" stroke-width="1" />`
        : '',
      label ? `<text x="${lx}" y="${ly + 3}" fill="${textColor}" text-anchor="middle" font-size="12">${label}</text>` : ''
    ].join('')
  }).join('')

  const nodeSvg = nodes.map((node) => {
    const pos = positions.get(node.id)
    if (!pos) return ''
    const text = escapeXml(node.label)
    const maxLength = 34
    const label = text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
    return [
      `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="10" ry="10" fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1.5" />`,
      `<text x="${pos.cx}" y="${pos.cy}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" font-size="13">${label}</text>`
    ].join('')
  }).join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Structurizr diagram">`,
    '<defs>',
    `<marker id="structurizr-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">`,
    `<polygon points="0 0, 10 3.5, 0 7" fill="${edgeStroke}" />`,
    '</marker>',
    '</defs>',
    edgeSvg,
    nodeSvg,
    '</svg>'
  ].join('')
}
