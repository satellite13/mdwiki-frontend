import { createMarkdownRenderer } from '@/components/editor/markdown'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const renderer = createMarkdownRenderer()

export function renderAnswerMarkdown(markdown: string): string {
  return sanitizeHtml(renderer.render(markdown))
}
