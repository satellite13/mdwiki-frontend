import MarkdownIt from 'markdown-it'
import TurndownService from 'turndown'

const mdIt = new MarkdownIt({ html: false, linkify: true, breaks: true })

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  })
  td.addRule('wikilink', {
    filter: (node): node is HTMLElement =>
      node.nodeName === 'SPAN' && (node as HTMLElement).hasAttribute('data-wikilink'),
    replacement(_content, node) {
      const el = node as HTMLElement
      const slug = el.getAttribute('data-wikilink') || ''
      const raw = el.textContent?.replace(/^\[\[|\]\]$/g, '').trim() || slug
      if (raw === slug) return `[[${slug}]]`
      return `[[${slug}|${raw}]]`
    },
  })
  td.addRule('hashtag', {
    filter: (node): node is HTMLElement =>
      node.nodeName === 'SPAN' && (node as HTMLElement).hasAttribute('data-hashtag'),
    replacement(_content, node) {
      const tag = (node as HTMLElement).getAttribute('data-hashtag') || ''
      return `#${tag}`
    },
  })
  return td
}

const turndown = createTurndown()

/** Markdown source or legacy HTML (from older saves) → HTML for Tiptap. */
export function markdownToEditorHtml(source: string): string {
  const s = source.trim()
  if (!s) return '<p></p>'
  if (s.startsWith('<')) return source
  return mdIt.render(source).trim() || '<p></p>'
}

/** Tiptap document HTML → markdown for API and .md files. */
export function editorHtmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim()
}
