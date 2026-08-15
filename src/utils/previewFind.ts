import { findMatchIndices } from '@/utils/editorFind'

const SKIP_CLOSEST = 'button, script, style, .heading-copy-btn, .code-copy-btn'

export type PreviewFindPiece = {
  node: Text
  start: number
  end: number
}

export function collectPreviewTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent ?? ''
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest(SKIP_CLOSEST)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  const nodes: Text[] = []
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }
  return nodes
}

export function findPreviewMatchRanges(root: HTMLElement, query: string): PreviewFindPiece[][] {
  const needle = query.trim()
  if (!needle) return []
  const nodes = collectPreviewTextNodes(root)
  if (nodes.length === 0) return []

  const lengths = nodes.map((n) => n.textContent?.length ?? 0)
  const full = nodes.map((n) => n.textContent ?? '').join('')
  const starts = findMatchIndices(full, needle)
  const needleLen = needle.length

  return starts.map((globalStart) => {
    const globalEnd = globalStart + needleLen
    const pieces: PreviewFindPiece[] = []
    let offset = 0
    for (let i = 0; i < nodes.length; i++) {
      const nodeStart = offset
      const nodeEnd = offset + lengths[i]
      const overlapStart = Math.max(globalStart, nodeStart)
      const overlapEnd = Math.min(globalEnd, nodeEnd)
      if (overlapStart < overlapEnd) {
        pieces.push({
          node: nodes[i],
          start: overlapStart - nodeStart,
          end: overlapEnd - nodeStart
        })
      }
      offset = nodeEnd
      if (offset >= globalEnd) break
    }
    return pieces
  })
}

export function clearPreviewFindHighlights(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll<HTMLElement>('mark.find-match'))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

export function applyPreviewFindHighlights(root: HTMLElement, query: string, activeIndex: number): number {
  clearPreviewFindHighlights(root)
  const matches = findPreviewMatchRanges(root, query)
  if (matches.length === 0) return 0

  const byNode = new Map<Text, Array<PreviewFindPiece & { matchIndex: number }>>()
  matches.forEach((pieces, matchIndex) => {
    for (const piece of pieces) {
      const list = byNode.get(piece.node) ?? []
      list.push({ ...piece, matchIndex })
      byNode.set(piece.node, list)
    }
  })

  for (const pieces of byNode.values()) {
    pieces.sort((a, b) => b.start - a.start)
    for (const piece of pieces) {
      wrapPiece(piece, piece.matchIndex === activeIndex)
    }
  }
  return matches.length
}

export function scrollPreviewFindActiveIntoView(root: HTMLElement): void {
  root.querySelector<HTMLElement>('mark.find-match-active')?.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  })
}

function wrapPiece(piece: PreviewFindPiece, isActive: boolean): void {
  const { node, start, end } = piece
  const text = node.textContent ?? ''
  if (start < 0 || end > text.length || start >= end) return
  const parent = node.parentNode
  if (!parent) return

  node.splitText(end)
  const matchNode = node.splitText(start)
  const mark = document.createElement('mark')
  mark.className = isActive ? 'find-match find-match-active' : 'find-match'
  parent.insertBefore(mark, matchNode)
  mark.appendChild(matchNode)
}
