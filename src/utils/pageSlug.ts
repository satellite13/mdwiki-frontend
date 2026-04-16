/** Приводит заголовок или текст вики-ссылки к slug страницы (как при создании из дерева). */
export function normalizePageSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
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
