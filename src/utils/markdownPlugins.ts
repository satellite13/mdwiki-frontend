import type MarkdownIt from 'markdown-it'
import { stripMarkdownFrontmatter } from '@/utils/frontmatter'
import { normalizePageSlug } from '@/utils/pageSlug'

/** Убирает frontmatter до парсинга, чтобы превью не показывало сырой YAML. */
export function frontmatterStripPlugin(md: MarkdownIt) {
  md.core.ruler.before('normalize', 'mdwiki_strip_frontmatter', (state) => {
    state.src = stripMarkdownFrontmatter(state.src)
  })
}

const WIKILINK_ICON = `<svg class="wikilink-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`

export function wikilinkPlugin(md: MarkdownIt) {
  const defaultTextRender = md.renderer.rules.text
  const esc = md.utils.escapeHtml

  md.renderer.rules.text = function (tokens, idx, options, env, self) {
    const content = tokens[idx].content
    const replaced = content.replace(
      /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
      (_match: string, slug: string, label?: string) => {
        const rawSlug = slug.trim()
        const normalized = normalizePageSlug(rawSlug)
        if (!normalized) return esc(_match)
        const displayText = label?.trim() || rawSlug
        const safeLabel = esc(displayText)
        return `<a href="/page/${normalized}" class="wikilink"><span class="wikilink-text">${safeLabel}</span>${WIKILINK_ICON}</a>`
      }
    )
    if (replaced !== content) return replaced
    if (defaultTextRender) return defaultTextRender(tokens, idx, options, env, self)
    return content
  }
}

export function tagPlugin(md: MarkdownIt) {
  const prevRender = md.renderer.rules.text

  md.renderer.rules.text = function (tokens, idx, options, env, self) {
    let content: string
    if (prevRender) {
      content = prevRender(tokens, idx, options, env, self)
    } else {
      content = tokens[idx].content
    }
    return content.replace(
      /(?:^|\s)#([\w\u0400-\u04FF-]+)/g,
      (match: string, tag: string) => {
        const prefix = match.startsWith(' ') ? ' ' : ''
        return `${prefix}<span class="hashtag">#${tag}</span>`
      }
    )
  }
}
