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
})
