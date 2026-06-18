import { listPages } from '@/api/pages'
import type { PageListItem } from '@/types'
import { normalizePageSlug, normalizeWikilinkKey } from '@/utils/pageSlug'

const TTL_MS = 30_000
const PAGE_FETCH_SIZE = 500

interface IndexSnapshot {
  pages: PageListItem[]
  fetchedAt: number
}

let snapshot: IndexSnapshot | null = null
let pendingFetch: Promise<PageListItem[]> | null = null

/**
 * Полностью сбросить индекс страниц (кэш списка + данные для preview/резолва).
 * Вызывается после создания/обновления/удаления/перемещения страницы и
 * при `tree-updated` SSE-событии.
 */
export function invalidatePageIndex(): void {
  snapshot = null
}

/** Сопоставление страницы с текстом внутри `[[...]]` (подстрока title/slug и нормализованный ключ). */
export function pageMatchesWikilinkQuery(item: PageListItem, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true
  const queryKey = normalizeWikilinkKey(rawQuery)
  const titleKey = normalizeWikilinkKey(item.title)
  const slugKey = normalizeWikilinkKey(item.slug)
  return (
    item.title.toLowerCase().includes(query) ||
    item.slug.toLowerCase().includes(query) ||
    (queryKey.length > 0 && (titleKey.includes(queryKey) || slugKey.includes(queryKey)))
  )
}

/** Внутренний запрос со схлопыванием одновременных обращений. */
function fetchPages(): Promise<PageListItem[]> {
  if (pendingFetch) return pendingFetch
  pendingFetch = (async () => {
    const all: PageListItem[] = []
    let page = 0
    let total = Number.POSITIVE_INFINITY

    while (all.length < total) {
      const res = await listPages({ page, size: PAGE_FETCH_SIZE })
      const headerTotal = res.headers['x-total-count']
      if (headerTotal != null && headerTotal !== '') {
        total = Number(headerTotal)
      } else if (res.data.length < PAGE_FETCH_SIZE) {
        total = all.length + res.data.length
      }
      all.push(...res.data)
      if (res.data.length === 0) break
      page += 1
    }

    snapshot = { pages: all, fetchedAt: Date.now() }
    return all
  })().finally(() => {
    pendingFetch = null
  })
  return pendingFetch
}

/**
 * Получить список страниц: возвращает кэш, если он свежее {@link TTL_MS},
 * иначе — подтягивает с API. `force: true` игнорирует TTL.
 */
export async function getPages(options: { force?: boolean } = {}): Promise<PageListItem[]> {
  const { force = false } = options
  if (!force && snapshot && Date.now() - snapshot.fetchedAt < TTL_MS) {
    return snapshot.pages
  }
  return fetchPages()
}

/** Синхронный снимок последнего известного списка страниц (пустой, если ничего не загружено). */
export function getCachedPages(): PageListItem[] {
  return snapshot?.pages ?? []
}

/**
 * Канонический slug страницы для текста внутри `[[...]]`
 * (как на API: slug или совпадение по нормализованному title).
 */
export function resolveWikilinkToSlug(rawInner: string): string | null {
  const trimmed = rawInner.trim()
  if (!trimmed) return null
  const key = normalizeWikilinkKey(trimmed)
  if (!key) return null

  const pages = getCachedPages()
  for (const p of pages) {
    if (normalizeWikilinkKey(p.slug) === key || p.slug === trimmed) return p.slug
  }
  for (const p of pages) {
    if (normalizeWikilinkKey(p.title) === key) return p.slug
  }
  return null
}

/**
 * href для preview-режима: резолв по индексу, иначе ключ как у
 * серверного `WikilinkService` (может не совпасть с файлом до загрузки индекса).
 */
export function wikilinkPreviewHref(rawInner: string): string {
  const resolved = resolveWikilinkToSlug(rawInner)
  const slug = resolved ?? normalizeWikilinkKey(rawInner.trim())
  if (!slug) return '#'
  return `/page/${encodeURIComponent(slug)}`
}

/** true, если индекс страниц уже загружен и цель `[[...]]` / `/page/...` не найдена. */
export function isMissingPageReference(rawInner: string): boolean {
  if (getCachedPages().length === 0) return false
  return resolveWikilinkToSlug(rawInner) === null
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
