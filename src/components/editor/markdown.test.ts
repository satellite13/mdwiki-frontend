import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMarkdownRenderer } from './markdown'

vi.mock('@/services/pageIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/pageIndex')>()
  return {
    ...actual,
    isMissingPageReference: vi.fn(() => false)
  }
})

import { isMissingPageReference } from '@/services/pageIndex'

const mockedIsMissing = vi.mocked(isMissingPageReference)

beforeEach(() => {
  mockedIsMissing.mockReturnValue(false)
})

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

describe('createMarkdownRenderer link classification', () => {
  it('renders external markdown links with icon and target blank', () => {
    const md = createMarkdownRenderer()
    const html = md.render('[GitHub](https://github.com)')

    expect(html).toContain('class="external-link"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('open_in_new')
    expect(html).not.toContain('mdlink-internal')
  })

  it('renders internal /page links with mdlink-internal class', () => {
    const md = createMarkdownRenderer()
    const html = md.render('[Страница](/page/foo)')

    expect(html).toContain('class="mdlink-internal"')
    expect(html).toContain('href="/page/foo"')
    expect(html).not.toContain('target="_blank"')
    expect(html).not.toContain('open_in_new')
  })

  it('renders linkify URLs as external links', () => {
    const md = createMarkdownRenderer()
    const html = md.render('См. https://example.com/page')

    expect(html).toContain('class="external-link"')
    expect(html).toContain('https://example.com/page')
    expect(html).toContain('open_in_new')
  })

  it('keeps wikilinks as wikilink only without external classes', () => {
    const md = createMarkdownRenderer()
    const html = md.render('См. [[other-page|Другая страница]]')

    expect(html).toContain('class="wikilink"')
    expect(html).not.toContain('external-link')
    expect(html).not.toContain('mdlink-internal')
    expect(html).not.toContain('open_in_new')
  })

  it('marks missing wikilinks with wikilink-missing class', () => {
    mockedIsMissing.mockImplementation((raw) => raw === 'ghost-page')
    const md = createMarkdownRenderer()
    const html = md.render('См. [[ghost-page|Призрак]] и [[real-page|Реальная]]')

    expect(html).toContain('class="wikilink wikilink-missing"')
    expect(html).toContain('data-missing="1"')
    expect(html).toContain('>Призрак<')
    expect(html).toContain('class="wikilink"')
    expect(html).not.toContain('[[real-page')
    expect(html).toContain('>Реальная<')
    expect(html).not.toMatch(/real-page[^<]*wikilink-missing/)
  })

  it('marks missing internal /page links with mdlink-internal-missing class', () => {
    mockedIsMissing.mockImplementation((raw) => raw === 'ghost-page')
    const md = createMarkdownRenderer()
    const html = md.render('[Призрак](/page/ghost-page)')

    expect(html).toContain('class="mdlink-internal mdlink-internal-missing"')
    expect(html).toContain('data-missing="1"')
  })
})
