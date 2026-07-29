/**
 * Как `WikilinkService.normalizePageSlug` на API: lower + дефисы, кириллица **не** транслитерируется.
 * Используется для текста внутри `[[...]]` и сопоставления с `title` в БД.
 */
const WIKILINK_NON_SLUG = /[^a-z0-9а-яё]+/giu

export function normalizeWikilinkKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(WIKILINK_NON_SLUG, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Соответствует regexp slug на API: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  і: 'i', ї: 'yi', є: 'ye', ґ: 'g'
}

function transliterateCyrillic(s: string): string {
  return [...s].map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch).join('')
}

/** Приводит заголовок или текст вики-ссылки к slug страницы (как при создании из дерева). */
export function normalizePageSlug(input: string): string {
  const base = transliterateCyrillic(input.toLowerCase().trim())
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Заголовок по умолчанию для новой страницы с данным slug. */
export function slugToDefaultTitle(slug: string): string {
  const parts = slug.split('-').filter(Boolean)
  if (parts.length === 0) return slug
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Заголовок новой страницы при переходе по ссылке: сохраняет написание из URL, если это один сегмент без `-`. */
export function titleForStubPage(slugFromRoute: string, normalizedSlug: string): string {
  const t = slugFromRoute.trim()
  if (t && !t.includes('-') && normalizePageSlug(t) === normalizedSlug) {
    return t
  }
  return slugToDefaultTitle(normalizedSlug)
}

/** Извлекает slug страницы из текущего URL (/page/:slug). null вне страницы просмотра. */
export function getPageSlugFromUrl(): string | null {
  const path = window.location.pathname
  const match = path.match(/^\/page\/(.+)/)
  return match ? match[1] : null
}
