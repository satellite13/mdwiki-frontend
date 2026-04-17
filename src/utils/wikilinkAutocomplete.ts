import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { listPages } from '@/api/pages'
import type { PageListItem } from '@/types'
import { normalizePageSlug } from '@/utils/pageSlug'
import { readWikilinkPagesCache, writeWikilinkPagesCache } from '@/utils/wikilinkPageListCache'

async function getCachedPages(): Promise<PageListItem[]> {
  const now = Date.now()
  const hit = readWikilinkPagesCache(now)
  if (hit) return hit
  const { data } = await listPages()
  writeWikilinkPagesCache(data, now)
  return data
}

function matchesQuery(p: PageListItem, q: string): boolean {
  const ql = q.toLowerCase()
  return (
    p.title.toLowerCase().includes(ql) ||
    p.slug.toLowerCase().includes(ql) ||
    normalizePageSlug(p.title).includes(ql)
  )
}

function sortKey(p: PageListItem, ql: string): number {
  if (!ql) return 0
  const slug = p.slug.toLowerCase()
  const title = p.title.toLowerCase()
  const nTitle = normalizePageSlug(p.title)
  if (slug === ql || title === ql || nTitle === ql) return 300
  if (slug.startsWith(ql) || title.startsWith(ql) || nTitle.startsWith(ql)) return 200
  return 100
}

function safeInsertTitle(title: string): string {
  return title.replace(/\]/g, '')
}

/** Метка после `|` в `[[slug|label]]` — без `]` и `|`, иначе парсер вики-ссылки сломается. */
function safeWikilinkLabel(title: string): string {
  return title.replace(/\]/g, '').replace(/\|/g, ' ')
}

/** Текст внутри `[[ ... ]]` — целевой slug, чтобы совпадал с файлом/БД, а не с `normalizePageSlug(title)`. */
function wikilinkInsertInner(p: PageListItem): string {
  const slug = p.slug
  const fromTitle = normalizePageSlug(p.title)
  if (fromTitle === slug) {
    return safeInsertTitle(p.title)
  }
  return `${slug}|${safeWikilinkLabel(p.title)}`
}

/**
 * Источник для пропа `completions` у md-editor-v3 (попадает в autocompletion override).
 * Подсказки при вводе [[...]] по списку страниц.
 */
export async function wikilinkCompletions(
  context: CompletionContext
): Promise<CompletionResult | null> {
  const match = context.matchBefore(/\[\[([^\]|]*)$/)
  if (!match) return null

  const query = match.text.slice(2)
  const from = match.from + 2
  const to = context.pos
  if (from > to) return null

  let pages: PageListItem[]
  try {
    pages = await getCachedPages()
  } catch {
    return null
  }

  const ql = query.trim()
  const filtered = !ql ? pages : pages.filter((p) => matchesQuery(p, ql))
  if (filtered.length === 0) return null

  const MAX = 25
  const sorted = [...filtered]
    .sort((a, b) => {
      const d = sortKey(b, ql) - sortKey(a, ql)
      if (d !== 0) return d
      return a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })
    })
    .slice(0, MAX)

  const options: Completion[] = sorted.map((p) => ({
    label: p.title,
    detail: p.slug,
    apply: wikilinkInsertInner(p),
    section: 'Wiki',
    boost: 9,
  }))

  return { from, to, options, filter: false }
}
