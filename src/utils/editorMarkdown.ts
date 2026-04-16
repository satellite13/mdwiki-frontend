import MarkdownIt from 'markdown-it'
import markdownItMark from 'markdown-it-mark'
import { frontmatterStripPlugin, tagPlugin, wikilinkPlugin } from '@/utils/markdownPlugins'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

md.use(markdownItMark)
md.use(frontmatterStripPlugin)
md.use(wikilinkPlugin)
md.use(tagPlugin)

export function markdownToEditorHtml(markdown: string): string {
  return md.render(markdown ?? '')
}
