import type MarkdownIt from 'markdown-it'

export function wikilinkPlugin(md: MarkdownIt) {
  const defaultTextRender = md.renderer.rules.text

  md.renderer.rules.text = function (tokens, idx, options, env, self) {
    const content = tokens[idx].content
    const replaced = content.replace(
      /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
      (_match: string, slug: string, label?: string) => {
        const displayText = label?.trim() || slug.trim()
        return `<a href="/page/${slug.trim()}" class="wikilink">[[${displayText}]]</a>`
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
