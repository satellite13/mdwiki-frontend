import DOMPurify from 'dompurify'

/**
 * Санитизация HTML перед вставкой через v-html.
 * Markdown-рендер работает с `html: true`, поэтому пользовательский HTML
 * необходимо пропускать через DOMPurify (защита от stored XSS).
 *
 * data-* атрибуты разрешены в DOMPurify по умолчанию (data-wikilink, data-slug и т.п.),
 * `target`/`translate` нужны для внешних ссылок и иконки open_in_new.
 */
const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'translate'],
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}
