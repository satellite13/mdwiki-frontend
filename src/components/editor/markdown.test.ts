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

  it('renders structurizr fence as escaped structurizr container', () => {
    const md = createMarkdownRenderer()
    const html = md.render('```structurizr\nperson = person "<Admin>"\n```')

    expect(html).toContain('<div class="structurizr">')
    expect(html).toContain('&lt;Admin&gt;')
    expect(html).not.toContain('<Admin>')
  })

  it('renders checked task item and following line without task-list columns', () => {
    const md = createMarkdownRenderer()
    const html = md.render(
      '- [x] Посмотреть этот агент, сравнить функциональность с `OpenCode`\nHermes агент это проактивный агент типа `OpenClaw` сравнивать с `OpenCode` нет смысла.'
    )

    expect(html).toContain('task-list-item')
    expect(html).toContain('checked')
    expect(html).not.toContain('<label')
    expect((html.match(/<code/g) ?? []).length).toBe(3)
  })

  it('renders list wikilinks with label separators outside tables', () => {
    const md = createMarkdownRenderer()
    const html = md.render('- [[multica-overview|Обзор Multica.ai]] — общая картина')

    expect(html).toContain('class="wikilink"')
    expect(html).toContain('>Обзор Multica.ai<')
    expect(html).not.toContain('[[multica-overview')
    expect(html).not.toContain('\uE000')
  })

  it('renders pipe tables with wikilink label separators as two columns', () => {
    const md = createMarkdownRenderer()
    const html = md.render(
      '| Сущность | Описание |\n| --- | --- |\n| [[axenix|AXENIX]] | Консалтинг, ИТ-решения |\n| [[dam|DAM]] | S3, CDN |\n'
    )

    expect((html.match(/<th>/g) ?? []).length).toBe(2)
    expect((html.match(/<td>/g) ?? []).length).toBe(4)
    expect(html).toContain('class="wikilink"')
    expect(html).toContain('>AXENIX<')
    expect(html).toContain('>DAM<')
    expect(html).toContain('Консалтинг, ИТ-решения')
  })
})
