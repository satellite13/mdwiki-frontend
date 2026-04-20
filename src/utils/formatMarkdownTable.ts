/** Alignment inferred from a GFM delimiter cell (between pipes). */
export type TableColumnAlign = 'default' | 'left' | 'right' | 'center'

export type FormatPipeTableResult = {
  text: string
  /** Caret index after the replaced block (exclusive end of new block). */
  cursor: number
}

function lineIndexAt(text: string, index: number): number {
  const safe = Math.max(0, Math.min(index, text.length))
  const before = text.slice(0, safe)
  return before.split('\n').length - 1
}

function hasPipe(line: string): boolean {
  return line.includes('|')
}

/** GFM delimiter cell: optional colons around one or more hyphens. */
const DELIM_CELL = /^\s*:?-+:?\s*$/

function isDelimiterRow(line: string): boolean {
  const t = line.trim()
  if (!t.includes('|') && !t.includes('-')) return false
  const cells = splitPipeCells(line)
  if (cells.length === 0) return false
  return cells.every((c) => DELIM_CELL.test(c))
}

function splitPipeCells(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  if (!t.includes('|') && t.length > 0) return [t]
  return t.split('|')
}

function parseDelimiterCell(cell: string): TableColumnAlign {
  const s = cell.trim()
  const m = s.match(/^(:?)(-+)(:?)$/)
  if (!m) return 'default'
  const [, left, dashes, right] = m
  if (dashes.length < 3) return 'default'
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return 'default'
}

function minWidthForAlign(a: TableColumnAlign): number {
  switch (a) {
    case 'center':
      return 5
    case 'left':
    case 'right':
      return 4
    default:
      return 3
  }
}

function formatDelimiterSegment(align: TableColumnAlign, width: number): string {
  const w = Math.max(width, minWidthForAlign(align))
  switch (align) {
    case 'left':
      return `:${'-'.repeat(w - 1)}`
    case 'right':
      return `${'-'.repeat(w - 1)}:`
    case 'center':
      return `:${'-'.repeat(w - 2)}:`
    default:
      return '-'.repeat(w)
  }
}

/** Pads to exactly `width` characters when `trim(content).length <= width`. */
function padCell(content: string, width: number, align: TableColumnAlign): string {
  const t = content.trim()
  if (t.length >= width) return t
  const pad = width - t.length
  if (align === 'right') return ' '.repeat(pad) + t
  if (align === 'center') {
    const left = Math.floor(pad / 2)
    const right = pad - left
    return ' '.repeat(left) + t + ' '.repeat(right)
  }
  return t + ' '.repeat(pad)
}

/** Same as `| a | b |` from the editor insert: join adds one space before each interior `|`. */
function joinRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

/**
 * Finds a contiguous GFM pipe-table block around `cursor` (must include a delimiter row).
 * Returns [start, end) indices in `text`.
 */
export function findPipeTableRange(text: string, cursor: number): { start: number; end: number } | null {
  const lines = text.split('\n')
  if (lines.length === 0) return null

  const curLine = lineIndexAt(text, cursor)
  if (curLine < 0 || curLine >= lines.length) return null

  let start = curLine
  while (start > 0 && hasPipe(lines[start - 1]!)) start--

  let end = curLine
  while (end < lines.length - 1 && hasPipe(lines[end + 1]!)) end++

  const block = lines.slice(start, end + 1)
  const delimIdx = block.findIndex((ln) => isDelimiterRow(ln))
  if (delimIdx <= 0) return null

  const colCounts = block.map((ln) => splitPipeCells(ln).length)
  const n = colCounts[0]!
  if (n === 0) return null
  if (!colCounts.every((c) => c === n)) return null

  let pos = 0
  for (let i = 0; i < start; i++) pos += lines[i]!.length + 1
  let endPos = pos
  for (let i = start; i <= end; i++) {
    endPos += lines[i]!.length
    if (i < end) endPos += 1
  }

  return { start: pos, end: endPos }
}

function formatTableLines(blockLines: string[]): string[] | null {
  if (blockLines.length < 2) return null
  const delimIdx = blockLines.findIndex((ln) => isDelimiterRow(ln))
  if (delimIdx <= 0) return null

  const colCounts = blockLines.map((ln) => splitPipeCells(ln).length)
  const cols = colCounts[0]!
  if (!colCounts.every((c) => c === cols) || cols === 0) return null

  const rows = blockLines.map((ln) => splitPipeCells(ln).map((c) => c.trim()))
  const aligns: TableColumnAlign[] = rows[delimIdx]!.map(parseDelimiterCell)

  const widths = Array.from({ length: cols }, () => 0)
  for (let r = 0; r < rows.length; r++) {
    if (r === delimIdx) continue
    for (let c = 0; c < cols; c++) {
      const cell = rows[r]![c] ?? ''
      widths[c] = Math.max(widths[c]!, cell.length)
    }
  }

  for (let c = 0; c < cols; c++) {
    widths[c] = Math.max(widths[c]!, minWidthForAlign(aligns[c]!))
  }

  for (let c = 0; c < cols; c++) {
    const seg = formatDelimiterSegment(aligns[c]!, widths[c]!)
    widths[c] = Math.max(widths[c]!, seg.length)
  }

  const out: string[] = []
  for (let r = 0; r < rows.length; r++) {
    if (r === delimIdx) {
      const segs = rows[r]!.map((_, c) => formatDelimiterSegment(aligns[c]!, widths[c]!))
      out.push(joinRow(segs))
      continue
    }
    const cells = rows[r]!.map((cell, c) => padCell(cell, widths[c]!, aligns[c]!))
    out.push(joinRow(cells))
  }
  return out
}

/**
 * If the cursor sits inside a pipe table, returns new full text with that table formatted
 * and a suggested caret position at the end of the table block.
 */
export function formatPipeTableAtCursor(text: string, cursor: number): FormatPipeTableResult | null {
  const range = findPipeTableRange(text, cursor)
  if (!range) return null

  const block = text.slice(range.start, range.end)
  const blockLines = block.split('\n')
  const formattedLines = formatTableLines(blockLines)
  if (!formattedLines) return null

  const formatted = formattedLines.join('\n')
  if (formatted === block) {
    return { text, cursor: range.end }
  }

  const next = text.slice(0, range.start) + formatted + text.slice(range.end)
  const nextCursor = range.start + formatted.length
  return { text: next, cursor: nextCursor }
}
