import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { escapeHtml } from '@/utils/htmlEscape'

/** Снимает обёртку `<p>…</p>`, если абзац — единственный верхнеуровневый элемент. */
function stripSingleParagraph(html: string): string {
  const trimmed = html.trim()
  if (trimmed.startsWith('<p>') && trimmed.endsWith('</p>') && !trimmed.slice(3, -4).includes('</p>')) {
    return trimmed.slice(3, -4)
  }
  return html
}

/**
 * Рендерит комментарий аннотации как безопасный HTML: markdown (включая [[wikilinks]]),
 * затем DOMPurify-санитизация. При ошибке возвращает исходный текст экранированным,
 * чтобы сырой контент никогда не попадал в разметку.
 */
export async function renderAnnotationComment(comment: string): Promise<string> {
  try {
    const { createMarkdownRenderer } = await import('../editor/markdown')
    const rendered = createMarkdownRenderer().render(comment)
    return stripSingleParagraph(sanitizeHtml(rendered))
  } catch {
    return escapeHtml(comment)
  }
}
