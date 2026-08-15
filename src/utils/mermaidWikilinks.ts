import { normalizePageSlug } from '@/utils/pageSlug'

export type MermaidWikilinkBinding = {
  nodeId: string
  slug: string
  label: string
}

export type MermaidWikilinkHrefOptions = {
  hrefForSlug: (slug: string) => string
  isMissing: (slug: string) => boolean
}

const NODE_ID_RE = /^[A-Za-z][\w]*$/

export function mermaidNodeIdFromSlug(slug: string): string {
  const base = normalizePageSlug(slug).replace(/-/g, '_') || 'wiki'
  return /^[A-Za-z]/.test(base) ? base : `n_${base}`
}

function escapeMermaidLabel(label: string): string {
  return label.replace(/"/g, '#quot;')
}

function isWhitespace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t'
}

function isEdgeLabelContext(source: string, wikiStart: number): boolean {
  let j = wikiStart - 1
  while (j >= 0 && isWhitespace(source[j])) j--
  return source[j] === '|'
}

function readNodeIdBefore(source: string, wikiStart: number): { id: string; start: number } | null {
  let j = wikiStart - 1
  while (j >= 0 && isWhitespace(source[j])) j--
  if (j < 0 || !/[\w]/.test(source[j]!)) return null
  const end = j + 1
  while (j >= 0 && /[\w]/.test(source[j]!)) j--
  const start = j + 1
  const id = source.slice(start, end)
  if (!NODE_ID_RE.test(id)) return null
  return { id, start }
}

function parseWikilinkAt(source: string, start: number): { end: number; slug: string; label: string } | null {
  if (source.slice(start, start + 2) !== '[[') return null
  const close = source.indexOf(']]', start + 2)
  if (close === -1) return null
  const inner = source.slice(start + 2, close)
  const pipe = inner.indexOf('|')
  if (pipe === -1) return null
  const slug = inner.slice(0, pipe).trim()
  const label = inner.slice(pipe + 1).trim()
  if (!slug || !label) return null
  return { end: close + 2, slug, label }
}

export function rewriteMermaidWikilinks(source: string): {
  source: string
  bindings: MermaidWikilinkBinding[]
} {
  const bindings: MermaidWikilinkBinding[] = []
  let out = ''
  let i = 0
  let inQuote = false

  while (i < source.length) {
    if (!inQuote && source.startsWith('%%', i)) {
      const nl = source.indexOf('\n', i)
      const to = nl === -1 ? source.length : nl + 1
      out += source.slice(i, to)
      i = to
      continue
    }

    const ch = source[i]!
    if (ch === '"') {
      inQuote = !inQuote
      out += ch
      i++
      continue
    }

    if (!inQuote && source.startsWith('[[', i) && !isEdgeLabelContext(source, i)) {
      const wiki = parseWikilinkAt(source, i)
      if (wiki) {
        const existing = readNodeIdBefore(source, i)
        const nodeId = existing?.id ?? mermaidNodeIdFromSlug(wiki.slug)
        if (existing) {
          out = out.slice(0, out.length - (i - existing.start))
        }
        out += `${nodeId}["${escapeMermaidLabel(wiki.label)}"]`
        bindings.push({ nodeId, slug: wiki.slug, label: wiki.label })
        i = wiki.end
        continue
      }
    }

    out += ch
    i++
  }

  return { source: out, bindings }
}

function nodeIdMatches(svgNodeId: string, nodeId: string): boolean {
  if (!svgNodeId) return false
  if (svgNodeId === nodeId) return true
  return svgNodeId.endsWith(`-${nodeId}`) || svgNodeId.includes(`-${nodeId}-`)
}

function findMermaidNode(root: ParentNode, nodeId: string): SVGGElement | null {
  const nodes = root.querySelectorAll<SVGGElement>('g.node')
  for (const el of nodes) {
    if (nodeIdMatches(el.id, nodeId)) return el
  }
  return null
}

export function bindMermaidWikilinkNodes(
  root: ParentNode,
  bindings: MermaidWikilinkBinding[],
  options: MermaidWikilinkHrefOptions
): void {
  const seen = new Set<string>()
  for (const binding of bindings) {
    if (seen.has(binding.nodeId)) continue
    seen.add(binding.nodeId)
    const node = findMermaidNode(root, binding.nodeId)
    if (!node || node.parentElement?.closest('a.wikilink')) continue

    const href = options.hrefForSlug(binding.slug)
    const missing = options.isMissing(binding.slug)
    const a = document.createElementNS('http://www.w3.org/2000/svg', 'a')
    a.setAttribute('href', href)
    a.setAttribute('class', missing ? 'wikilink wikilink-missing' : 'wikilink')
    a.setAttribute('data-wikilink', '1')
    a.setAttribute('data-slug', binding.slug)
    a.style.cursor = 'pointer'
    node.parentNode?.insertBefore(a, node)
    a.appendChild(node)
  }
}
