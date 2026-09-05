import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ViewsPage from './ViewsPage.vue'
import { i18n } from '@/i18n'

const listViews = vi.fn()
const runView = vi.fn()
const listPropertyDefinitions = vi.fn()
vi.mock('@/api/views', () => ({ listViews: (...args: unknown[]) => listViews(...args), runView: (...args: unknown[]) => runView(...args), createView: vi.fn(), deleteView: vi.fn() }))
vi.mock('@/api/properties', () => ({ listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args) }))

describe('ViewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPropertyDefinitions.mockResolvedValue({ data: [] })
    listViews.mockResolvedValue({ data: [{ id: 'cards', name: 'Cards', type: 'CARDS' }] })
    runView.mockResolvedValue({ data: { items: [{ page: { id: 'p1', slug: 'one', title: 'One' } }] } })
  })

  it('renders card results semantically for a cards view', async () => {
    const wrapper = mount(ViewsPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    await wrapper.get('li button').trigger('click')
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('article').text()).toContain('One')
  })

  it('appends cursor pages and retries a failed load more request', async () => {
    const wrapper = mount(ViewsPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    runView
      .mockResolvedValueOnce({ data: { items: [{ page: { id: 'p1', slug: 'one', title: 'One' } }], nextCursor: 'cursor-1' } })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { items: [{ page: { id: 'p2', slug: 'two', title: 'Two' } }], nextCursor: null } })

    await wrapper.get('li button').trigger('click')
    await flushPromises()
    const loadMore = wrapper.get('button[aria-label="Load more view results"]')
    expect(loadMore.text()).toBe('Load more results')

    await loadMore.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not run view.')

    await wrapper.get('button[aria-label="Load more view results"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('One')
    expect(wrapper.text()).toContain('Two')
    expect(runView).toHaveBeenLastCalledWith('cards', 'cursor-1')
  })
})
