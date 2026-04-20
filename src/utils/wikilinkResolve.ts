import client from '@/api/client'
import type { PageListItem } from '@/types'
import { normalizePageSlug, normalizeWikilinkKey } from '@/utils/pageSlug'
import { readWikilinkPagesCache, writeWikilinkPagesCache } from '@/utils/wikilinkPageListCache'

let previewPages: PageListItem[] = []

/** Сброс индекса (кэш списка страниц сброшен отдельно). */
export function clearWikilinkPreviewPages(): void {
  previewPages = []
}

export function getWikilinkPreviewPages(): PageListItem[] {
  return previewPages
}

/** Загрузка списка страниц для превью и резолвинга; использует тот же TTL-кэш, что и автодополнение [[. */
export async function refreshWikilinkPreviewIndex(force = false): Promise<void> {
  const now = Date.now()
  if (!force) {
    const hit = readWikilinkPagesCache(now)
    if (hit) {
      previewPages = hit
      return
    }
  }
  const { data } = await client.get<PageListItem[]>('/pages')
  writeWikilinkPagesCache(data, now)
  previewPages = data
}

/**
 * Канонический slug страницы для текста внутри [[...]] (как на API: slug или совпадение по нормализованному title).
 */
export function resolveWikilinkToSlug(rawInner: string): string | null {
  const trimmed = rawInner.trim()
  if (!trimmed) return null
  const key = normalizeWikilinkKey(trimmed)
  if (!key) return null

  for (const p of previewPages) {
    if (normalizeWikilinkKey(p.slug) === key || p.slug === trimmed) return p.slug
  }
  for (const p of previewPages) {
    if (normalizeWikilinkKey(p.title) === key) return p.slug
  }
  return null
}

/** href для превью: резолв по индексу, иначе ключ как у WikilinkService (может не совпасть с файлом до загрузки индекса). */
export function wikilinkPreviewHref(rawInner: string): string {
  const resolved = resolveWikilinkToSlug(rawInner)
  const slug = resolved ?? normalizeWikilinkKey(rawInner.trim())
  if (!slug) return '#'
  return `/page/${encodeURIComponent(slug)}`
}

/** Варианты slug для GET /pages/{slug} после перехода по ссылке (в т.ч. устаревший транслит в URL). */
export function slugCandidatesForNavigation(urlSlug: string, pages: PageListItem[]): string[] {
  let decoded = urlSlug
  try {
    decoded = decodeURIComponent(urlSlug)
  } catch {
    /* оставляем как есть */
  }
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    const t = s?.trim()
    if (t && !out.includes(t)) out.push(t)
  }

  add(decoded)
  add(normalizeWikilinkKey(decoded))
  add(normalizePageSlug(decoded))

  const wk = normalizeWikilinkKey(decoded)
  const legacy = normalizePageSlug(decoded)

  for (const p of pages) {
    if (normalizeWikilinkKey(p.title) === wk) add(p.slug)
    if (normalizePageSlug(p.title) === decoded) add(p.slug)
    if (normalizePageSlug(p.title) === legacy) add(p.slug)
  }

  return out
}
