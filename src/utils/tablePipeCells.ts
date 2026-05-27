/**
 * Private-use placeholder so GFM table parsers do not treat wikilink label `|`
 * as a column separator. Restored when rendering wikilinks.
 */
export const WIKILINK_TABLE_PIPE = '\uE000'

const WIKILINK_WITH_LABEL = /\[\[([^\]|]+?)\|([^\]]+?)\]\]/g
const DELIM_CELL = /^\s*:?-+:?\s*$/

function hasPipe(line: string): boolean {
  return line.includes('|')
}

function isDelimiterRow(line: string): boolean {
  const t = line.trim()
  if (!t.includes('|') && !t.includes('-')) return false
  const cells = splitTablePipeCells(line)
  if (cells.length === 0) return false
  return cells.every((c) => DELIM_CELL.test(c.trim()))
}

/** Last line index of a GFM pipe-table block starting at `start`, or null. */
function pipeTableBlockEnd(lines: string[], start: number): number | null {
  let end = start
  while (end < lines.length && hasPipe(lines[end]!)) end++
  if (end - start < 2) return null

  const block = lines.slice(start, end)
  const delimIdx = block.findIndex((ln) => isDelimiterRow(ln))
  if (delimIdx <= 0) return null

  const colCounts = block.map((ln) => splitTablePipeCells(ln).length)
  const cols = colCounts[0]!
  if (cols === 0 || !colCounts.every((c) => c === cols)) return null

  return end - 1
}

/** Replaces `|` between wikilink slug and label on one table row. */
export function protectWikilinkTablePipes(line: string): string {
  return line.replace(
    WIKILINK_WITH_LABEL,
    (_m, slug: string, label: string) => `[[${slug}${WIKILINK_TABLE_PIPE}${label}]]`
  )
}

/** Protects wikilink label separators only inside GFM pipe-table blocks. */
export function protectWikilinkTablePipesInDocument(src: string): string {
  const lines = src.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const blockEnd = pipeTableBlockEnd(lines, i)
    if (blockEnd === null) {
      out.push(lines[i]!)
      i++
      continue
    }
    for (let j = i; j <= blockEnd; j++) {
      out.push(protectWikilinkTablePipes(lines[j]!))
    }
    i = blockEnd + 1
  }
  return out.join('\n')
}

/**
 * Splits a GFM table row on column pipes, ignoring `|` inside `[[wikilinks]]`
 * and `` `inline code` ``.
 */
export function splitTablePipeCells(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  if (!t.includes('|') && t.length > 0) return [t]
  if (!t) return []

  const cells: string[] = []
  let cell = ''
  let i = 0
  let inWikilink = false
  let inInlineCode = false

  while (i < t.length) {
    const ch = t[i]!
    const next = t[i + 1]

    if (ch === '`' && !inWikilink) {
      inInlineCode = !inInlineCode
      cell += ch
      i++
      continue
    }

    if (!inInlineCode && ch === '[' && next === '[') {
      inWikilink = true
      cell += '[['
      i += 2
      continue
    }

    if (inWikilink && ch === ']' && next === ']') {
      cell += ']]'
      i += 2
      inWikilink = false
      continue
    }

    if (!inInlineCode && !inWikilink && ch === '|') {
      cells.push(cell)
      cell = ''
      i++
      continue
    }

    cell += ch
    i++
  }

  cells.push(cell)
  return cells
}
