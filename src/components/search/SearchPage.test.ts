import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import SearchPage from './SearchPage.vue'
import { i18n } from '@/i18n'

const route = reactive({ query: { q: 'knowledge' } as Record<string, string> })
const replace = vi.fn()
const searchPages = vi.fn()
const searchPagesRag = vi.fn()
const answerQuestion = vi.fn()
const getSavedSearch = vi.fn()
const alert = vi.fn()
const prompt = vi.fn()
const confirm = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace })
}))
vi.mock('@/api/search', () => ({
  searchPages: (...args: unknown[]) => searchPages(...args),
  searchPagesRag: (...args: unknown[]) => searchPagesRag(...args),
  answerQuestion: (...args: unknown[]) => answerQuestion(...args)
}))
vi.mock('@/api/savedSearches', () => ({
  getSavedSearch: (...args: unknown[]) => getSavedSearch(...args),
  createSavedSearch: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn()
}))
vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({ alert, prompt, confirm })
}))

function mountPage(attachToDocument = false) {
  return mount(SearchPage, {
    attachTo: attachToDocument ? document.body : undefined,
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>'
        },
        SkeletonPage: true
      }
    }
  })
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    route.query = { q: 'knowledge' }
    searchPages.mockResolvedValue({
      data: [{ pageId: '1', slug: 'alpha', title: 'Alpha', snippet: 'text result' }]
    })
    searchPagesRag.mockResolvedValue({
      data: [{
        pageSlug: 'alpha',
        pageTitle: 'Alpha',
        sectionHeading: 'Details',
        sectionKey: 'details-key',
        snippet: 'semantic result',
        score: 0.9,
        tags: ['pkm']
      }]
    })
    answerQuestion.mockResolvedValue({ data: { answerMd: '', citations: [], grounded: false, model: 'extractive-rag' } })
  })

  it('defaults to hybrid search and builds section deep links', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(searchPages).toHaveBeenCalledWith('knowledge')
    expect(searchPagesRag).toHaveBeenCalledWith('knowledge')
    expect(wrapper.get('[role="radiogroup"]').text()).toContain('Hybrid')
    expect(wrapper.get('.result-card a').attributes('href'))
      .toBe('/page/alpha?section=details-key')
    expect(wrapper.findAll('.source-badge').map((node) => node.text()))
      .toEqual(['Text', 'Semantic'])
    expect(replace).toHaveBeenCalledWith({
      query: { q: 'knowledge', mode: 'hybrid' }
    })
  })

  it('canonicalizes an invalid mode to hybrid while preserving query', async () => {
    route.query = { q: 'knowledge', mode: 'unknown' }
    mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({
      query: { q: 'knowledge', mode: 'hybrid' }
    })
  })

  it('canonicalizes invalid mode introduced by in-place navigation', async () => {
    route.query = { q: 'knowledge', mode: 'semantic' }
    mountPage()
    await flushPromises()
    vi.clearAllMocks()

    route.query = { q: 'knowledge', mode: 'invalid' }
    await flushPromises()

    expect(replace).toHaveBeenCalledWith({
      query: { q: 'knowledge', mode: 'hybrid' }
    })
  })

  it('uses one tab stop and supports keyboard selection in the radiogroup', async () => {
    const wrapper = mountPage(true)
    await flushPromises()
    const radios = wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual(['0', '-1', '-1'])

    radios[0]!.element.focus()
    await radios[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(replace).toHaveBeenLastCalledWith({
      query: { q: 'knowledge', mode: 'text' }
    })
    expect(document.activeElement).toBe(radios[1]!.element)

    await radios[1]!.trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(document.activeElement).toBe(radios[2]!.element)
    expect(radios[2]!.attributes('aria-checked')).toBe('true')

    await radios[2]!.trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(document.activeElement).toBe(radios[0]!.element)

    await radios[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(document.activeElement).toBe(radios[2]!.element)
    expect(radios[2]!.attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })

  it('moves selection and focus before pending search requests resolve', async () => {
    const wrapper = mountPage(true)
    await flushPromises()
    const pending = new Promise<never>(() => {})
    searchPages.mockReturnValue(pending)
    searchPagesRag.mockReturnValue(pending)
    replace.mockClear()
    const radios = wrapper.findAll<HTMLButtonElement>('[role="radio"]')

    radios[0]!.element.focus()
    await radios[0]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(radios[1]!.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[1]!.element)

    await radios[1]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(radios[2]!.attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[2]!.element)
    expect(replace).toHaveBeenNthCalledWith(1, {
      query: { q: 'knowledge', mode: 'text' }
    })
    expect(replace).toHaveBeenNthCalledWith(2, {
      query: { q: 'knowledge', mode: 'semantic' }
    })
    wrapper.unmount()
  })

  it('clears loading state when the query is emptied during a pending search', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const pending = new Promise<never>(() => {})
    searchPages.mockReturnValue(pending)
    searchPagesRag.mockReturnValue(pending)

    route.query = { q: 'pending', mode: 'hybrid' }
    await nextTick()
    expect(wrapper.findComponent({ name: 'SkeletonPage' }).exists()).toBe(true)

    route.query = { q: '', mode: 'hybrid' }
    await nextTick()
    expect(wrapper.findComponent({ name: 'SkeletonPage' }).exists()).toBe(false)
    expect(wrapper.find('.search-warning').exists()).toBe(false)
    expect(wrapper.findAll('.result-card')).toHaveLength(0)
  })

  it('clears pending state while canonicalizing an invalid mode for an empty query', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const pending = new Promise<never>(() => {})
    searchPages.mockReturnValue(pending)
    searchPagesRag.mockReturnValue(pending)

    route.query = { q: 'pending', mode: 'hybrid' }
    await nextTick()
    expect(wrapper.findComponent({ name: 'SkeletonPage' }).exists()).toBe(true)
    replace.mockClear()

    route.query = { q: '', mode: 'invalid' }
    await nextTick()
    expect(wrapper.findComponent({ name: 'SkeletonPage' }).exists()).toBe(false)
    expect(wrapper.find('.search-warning').exists()).toBe(false)
    expect(wrapper.findAll('.result-card')).toHaveLength(0)
    expect(replace).toHaveBeenCalledWith({ query: { q: '', mode: 'hybrid' } })
  })

  it('keeps FTS results and shows a non-blocking warning when semantic search fails', async () => {
    searchPagesRag.mockRejectedValue(new Error('semantic unavailable'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Semantic search is unavailable')
    expect(wrapper.text()).toContain('text result')
    expect(alert).not.toHaveBeenCalled()
  })

  it('only applies score filtering in semantic mode', async () => {
    route.query = { q: 'knowledge', mode: 'semantic' }
    const wrapper = mountPage()
    await flushPromises()

    expect(searchPages).not.toHaveBeenCalled()
    expect(wrapper.find('.score-filter').exists()).toBe(true)
    await wrapper.get('.score-select').setValue('0.9')
    expect(wrapper.findAll('.result-card')).toHaveLength(1)
  })

  it('sanitizes grounded answer and renders citation route without hiding hits', async () => {
    answerQuestion.mockResolvedValue({ data: {
      answerMd: '**Safe** [1]<img src=x onerror=alert(1)>',
      grounded: true,
      model: 'extractive-rag',
      citations: [{ id: 1, pageSlug: 'alpha', pageTitle: 'Alpha', sectionKey: 'stable',
        sectionHeading: 'H', quote: 'Safe', score: 0.9 }]
    } })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.answer-panel button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.answer-text').html()).toContain('<strong>Safe</strong>')
    expect(wrapper.get('.answer-text').html()).not.toContain('onerror')
    expect(wrapper.findAll('.result-card')).toHaveLength(1)
    expect(wrapper.get('.answer-panel ol a').text()).toContain('Alpha')
  })

  it('hydrates saved definition and keeps saved id in canonical URL', async () => {
    route.query = { saved: 's1' }
    getSavedSearch.mockResolvedValue({ data: {
      id: 's1', name: 'Mine', queryText: 'saved query', mode: 'TEXT', tags: ['one'],
      minScore: null, sort: 'UPDATED', version: 1, createdAt: '', updatedAt: ''
    } })
    mountPage()
    await flushPromises()

    expect(getSavedSearch).toHaveBeenCalledWith('s1')
    expect(replace).toHaveBeenCalledWith({ query: {
      saved: 's1', q: 'saved query', mode: 'text', tags: 'one', minScore: '', sort: 'updated'
    } })
    expect(searchPages).toHaveBeenCalledWith('saved query')
  })
})
