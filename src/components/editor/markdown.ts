import MarkdownIt from 'markdown-it'
import markdownItMark from 'markdown-it-mark'
import markdownItTaskLists from 'markdown-it-task-lists'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { stripMarkdownFrontmatter } from '@/utils/frontmatter'
import { normalizePageSlug } from '@/utils/pageSlug'
import { wikilinkPreviewHref } from '@/services/pageIndex'

export const WIKI_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g
export const TAG_REGEX = /(?:^|\s)#([\w\u0400-\u04FF-]+)/g

let highlightLanguagesRegistered = false

function registerHighlightLanguages() {
  if (highlightLanguagesRegistered) return
  const langEntries: Array<[string, any]> = [
    ['plaintext', plaintext],
    ['text', plaintext],
    ['bash', bash],
    ['sh', bash],
    ['shell', bash],
    ['javascript', javascript],
    ['js', javascript],
    ['typescript', typescript],
    ['ts', typescript],
    ['json', json],
    ['yaml', yaml],
    ['yml', yaml],
    ['xml', xml],
    ['html', xml],
    ['css', css],
    ['markdown', markdown],
    ['md', markdown],
    ['python', python],
    ['py', python],
    ['java', java],
    ['kotlin', kotlin],
    ['sql', sql]
  ]
  for (const [name, definition] of langEntries) {
    hljs.registerLanguage(name, definition)
  }
  highlightLanguagesRegistered = true
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function frontmatterStripPlugin(md: MarkdownIt) {
  md.core.ruler.before('normalize', 'mdwiki_strip_frontmatter', (state) => {
    state.src = stripMarkdownFrontmatter(state.src)
  })
}

function wikilinkPlugin(md: MarkdownIt) {
  const prev = md.renderer.rules.text
  md.renderer.rules.text = (tokens, idx, options, env, self) => {
    const source = prev ? prev(tokens, idx, options, env, self) : tokens[idx].content
    return source.replace(WIKI_REGEX, (_m, slugRaw: string, labelRaw?: string) => {
      const slug = slugRaw.trim()
      const label = (labelRaw?.trim() || slug).trim()
      const href = wikilinkPreviewHref(slug)
      return `<a href="${escapeHtml(href)}" class="wikilink" data-wikilink="1" data-slug="${escapeHtml(slug)}">${escapeHtml(label)}</a>`
    })
  }
}

function tagPlugin(md: MarkdownIt) {
  const prev = md.renderer.rules.text
  md.renderer.rules.text = (tokens, idx, options, env, self) => {
    const source = prev ? prev(tokens, idx, options, env, self) : tokens[idx].content
    return source.replace(TAG_REGEX, (full: string, tag: string) => {
      const prefix = full.startsWith(' ') ? ' ' : ''
      return `${prefix}<span class="hashtag">#${escapeHtml(tag)}</span>`
    })
  }
}

function mermaidFencePlugin(md: MarkdownIt) {
  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = (token.info || '').trim().toLowerCase()
    if (info === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(token.content)}</div>`
    }
    if (info === 'structurizr' || info === 'structurizer') {
      return `<div class="structurizr">${escapeHtml(token.content)}</div>`
    }
    if (defaultFence) return defaultFence(tokens, idx, options, env, self)
    return self.renderToken(tokens, idx, options)
  }
}

export function createMarkdownRenderer(): MarkdownIt {
  registerHighlightLanguages()
  return new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    highlight(code: string, lang: string) {
      const hasLanguage = !!lang && hljs.getLanguage(lang)
      const highlighted = hasLanguage
        ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(code).value
      return `<pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ''}">${highlighted}</code></pre>`
    }
  })
    .use(markdownItMark)
    .use(markdownItTaskLists, { enabled: false, label: false, labelAfter: false })
    .use(markdownItSub)
    .use(markdownItSup)
    .use(markdownItAnchor, {
      level: [1, 2, 3, 4, 5, 6],
      slugify: (s) => normalizePageSlug(s) || 'section',
      permalink: markdownItAnchor.permalink.headerLink({
        safariReaderFix: true,
        symbol: '#',
        renderAttrs: () => ({
          class: 'heading-anchor',
          'aria-label': 'Ссылка на раздел'
        })
      })
    })
    .use(frontmatterStripPlugin)
    .use(wikilinkPlugin)
    .use(tagPlugin)
    .use(mermaidFencePlugin)
}
