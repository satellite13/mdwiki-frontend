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
import { protectWikilinkTablePipesInDocument, WIKILINK_TABLE_PIPE } from '@/utils/tablePipeCells'
import { wikilinkPreviewHref } from '@/services/pageIndex'
import { classifyPreviewLinkHref } from '@/utils/previewLinks'

const EXTERNAL_LINK_ICON =
  '<span class="external-link-icon material-symbols-outlined notranslate" translate="no" aria-hidden="true">open_in_new</span>'

export const WIKI_REGEX = new RegExp(
  `\\[\\[([^\\]|]+?)(?:[|${WIKILINK_TABLE_PIPE}]([^\\]]+?))?\\]\\]`,
  'g'
)
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

function protectWikilinkTablePipesPlugin(md: MarkdownIt) {
  md.core.ruler.before('block', 'mdwiki_protect_wikilink_table_pipes', (state) => {
    state.src = protectWikilinkTablePipesInDocument(state.src)
  })
}

function renderWikilinkLink(slugRaw: string, labelRaw: string | undefined, Token: typeof import('markdown-it/lib/token.mjs').default, level: number) {
  const slug = slugRaw.trim()
  const label = (labelRaw?.trim() || slug).trim()
  const href = wikilinkPreviewHref(slug)

  const open = new Token('link_open', 'a', 1)
  open.attrs = [
    ['href', href],
    ['class', 'wikilink'],
    ['data-wikilink', '1'],
    ['data-slug', slug]
  ]
  open.level = level
  open.markup = 'wikilink'

  const text = new Token('text', '', 0)
  text.content = label
  text.level = level + 1

  const close = new Token('link_close', 'a', -1)
  close.level = level
  close.markup = 'wikilink'

  return [open, text, close]
}

function wikilinkTokenizePlugin(md: MarkdownIt) {
  md.core.ruler.before('linkify', 'mdwiki_wikilink_tokenize', (state) => {
    const Token = state.Token

    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue

      const nextChildren: typeof blockToken.children = []
      for (const token of blockToken.children) {
        if (token.type !== 'text' || !token.content.includes('[[')) {
          nextChildren.push(token)
          continue
        }

        const content = token.content
        let lastIndex = 0
        let matched = false
        WIKI_REGEX.lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = WIKI_REGEX.exec(content)) !== null) {
          matched = true
          if (match.index > lastIndex) {
            const rest = new Token('text', '', 0)
            rest.content = content.slice(lastIndex, match.index)
            rest.level = token.level
            nextChildren.push(rest)
          }
          nextChildren.push(...renderWikilinkLink(match[1], match[2], Token, token.level))
          lastIndex = WIKI_REGEX.lastIndex
        }

        if (!matched) {
          nextChildren.push(token)
          continue
        }

        if (lastIndex < content.length) {
          const rest = new Token('text', '', 0)
          rest.content = content.slice(lastIndex)
          rest.level = token.level
          nextChildren.push(rest)
        }
      }

      blockToken.children = nextChildren
    }
  })
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

function linkClassifyPlugin(md: MarkdownIt) {
  const defaultLinkOpen = md.renderer.rules.link_open
  const defaultLinkClose = md.renderer.rules.link_close

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.markup === 'wikilink') {
      return defaultLinkOpen
        ? defaultLinkOpen(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options)
    }

    const href = token.attrGet('href') || ''
    const kind = classifyPreviewLinkHref(href)
    if (kind === 'external') {
      token.attrSet('class', 'external-link')
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    } else {
      token.attrSet('class', 'mdlink-internal')
    }

    return defaultLinkOpen
      ? defaultLinkOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
    let openToken: (typeof tokens)[number] | null = null
    for (let i = idx - 1; i >= 0; i--) {
      if (tokens[i].type === 'link_open') {
        openToken = tokens[i]
        break
      }
    }

    const closeHtml = defaultLinkClose
      ? defaultLinkClose(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)

    if (!openToken || openToken.markup === 'wikilink') return closeHtml

    const href = openToken.attrGet('href') || ''
    if (classifyPreviewLinkHref(href) === 'external') {
      return EXTERNAL_LINK_ICON + closeHtml
    }
    return closeHtml
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
    .use(protectWikilinkTablePipesPlugin)
    .use(wikilinkTokenizePlugin)
    .use(tagPlugin)
    .use(linkClassifyPlugin)
    .use(mermaidFencePlugin)
}
