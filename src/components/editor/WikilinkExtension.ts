import { Node, mergeAttributes } from '@tiptap/core'

export const WikilinkExtension = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      slug: { default: null },
      label: { default: null }
    }
  },

  parseHTML() { return [{ tag: 'span[data-wikilink]' }] },

  renderHTML({ HTMLAttributes }) {
    const slug = HTMLAttributes.slug || ''
    const label = HTMLAttributes.label || slug
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-wikilink': slug, class: 'wikilink',
      style: 'color: var(--color-wikilink); cursor: pointer; text-decoration: underline;'
    }), `[[${label}]]`]
  },

  addInputRules() {
    return [{
      find: /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]$/,
      handler: ({ state, range, match }) => {
        const slug = match[1].trim()
        const label = match[2]?.trim() || null
        const { tr } = state
        tr.replaceWith(range.from, range.to, this.type.create({ slug, label }))
      }
    }]
  }
})
