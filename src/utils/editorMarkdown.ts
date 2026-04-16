import MarkdownIt from 'markdown-it'
import { tagPlugin, wikilinkPlugin } from '@/utils/markdownPlugins'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

md.use(wikilinkPlugin)
md.use(tagPlugin)

export function markdownToEditorHtml(markdown: string): string {
  return md.render(markdown ?? '')
}
