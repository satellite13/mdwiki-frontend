/**
 * Private-use placeholder so GFM table parsers do not treat wikilink label `|`
 * as a column separator. Restored when rendering wikilinks.
 */
export const WIKILINK_TABLE_PIPE = '\uE000'

const WIKILINK_WITH_LABEL = /\[\[([^\]|]+?)\|([^\]]+?)\]\]/g

/** Replaces `|` between wikilink slug and label before markdown/table parsing. */
export function protectWikilinkTablePipes(src: string): string {
  return src.replace(
    WIKILINK_WITH_LABEL,
    (_m, slug: string, label: string) => `[[${slug}${WIKILINK_TABLE_PIPE}${label}]]`
  )
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
