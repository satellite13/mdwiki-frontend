import { Node, mergeAttributes, InputRule } from '@tiptap/core'

export const TagExtension = Node.create({
  name: 'hashtag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { tag: { default: null } }
  },

  parseHTML() { return [{ tag: 'span[data-hashtag]' }] },

  renderHTML({ HTMLAttributes }) {
    const tag = HTMLAttributes.tag || ''
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-hashtag': tag, class: 'hashtag',
      style: 'color: var(--color-tag); cursor: pointer;'
    }), `#${tag}`]
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)#([\w\u0400-\u04FF-]+)\s$/u,
        handler: ({ state, range, match }) => {
          const tag = match[1]
          const { tr } = state
          const start = range.from + (match[0].startsWith(' ') ? 1 : 0)
          tr.replaceWith(start, range.to, [
            this.type.create({ tag }),
            state.schema.text(' ')
          ])
        }
      })
    ]
  }
})
