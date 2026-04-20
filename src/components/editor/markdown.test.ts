import { describe, expect, it } from 'vitest'
import { createMarkdownRenderer } from './markdown'

describe('createMarkdownRenderer task lists', () => {
  it('renders inline code in a task item without duplicated raw markdown text', () => {
    const md = createMarkdownRenderer()
    const html = md.render('- [ ] Посмотреть этот агент, сравнить функциональность с `OpenCode`')

    expect(html).toContain('task-list-item')
    expect((html.match(/Посмотреть этот агент, сравнить функциональность с/g) ?? []).length).toBe(1)
    expect((html.match(/<code/g) ?? []).length).toBe(1)
    expect(html).not.toContain('`OpenCode`')
  })
})
