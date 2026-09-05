import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ViewsPage from './ViewsPage.vue'
import { i18n } from '@/i18n'

const listViews = vi.fn()
const runView = vi.fn()
const createView = vi.fn()
const deleteView = vi.fn()
const listPropertyDefinitions = vi.fn()
vi.mock('@/api/views', () => ({
  listViews: (...args: unknown[]) => listViews(...args),
  runView: (...args: unknown[]) => runView(...args),
  createView: (...args: unknown[]) => createView(...args),
  deleteView: (...args: unknown[]) => deleteView(...args),
}))
vi.mock('@/api/properties', () => ({ listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args) }))

async function pickFieldOption(field: VueWrapper, value: string) {
  await field.get('[data-testid="app-select-trigger"]').trigger('click')
  const testId = value === '' ? 'app-select-option-empty' : `app-select-option-${value}`
  await field.get(`[data-testid="${testId}"]`).trigger('click')
}

function fieldByLabel(wrapper: VueWrapper, scope: string, label: string) {
  return wrapper.findAll(`${scope} .field`).find((node) =>
    node.text().includes(label)
  )!
}

describe('ViewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPropertyDefinitions.mockResolvedValue({ data: [{
      id: 'd1', key: 'status', displayName: 'Status', type: 'SELECT',
      config: { options: ['todo', 'done'] }, required: false, version: 1, createdAt: '', updatedAt: ''
    }] })
    listViews.mockResolvedValue({ data: [{
      id: 'cards', name: 'Cards', type: 'CARDS', filters: [{ key: 'status', op: 'EQ', value: 'done' }],
      sort: [], grouping: null, layout: {}, version: 1, createdAt: '', updatedAt: ''
    }] })
    runView.mockResolvedValue({ data: { items: [{ page: { id: 'p1', slug: 'one', title: 'One' } }] } })
    createView.mockResolvedValue({ data: { id: 'new' } })
  })

  it('renders card results semantically for a cards view', async () => {
    const wrapper = mount(ViewsPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    await wrapper.get('.library-list .link-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('article').text()).toContain('One')
    expect(wrapper.text()).toContain('Status = done')
  })

  it('creates a view with a property filter', async () => {
    const wrapper = mount(ViewsPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()

    const nameInput = wrapper.findAll('.create-form .field input').find((node) =>
      node.element.closest('.field')?.querySelector('.field-label')?.textContent?.includes('View name')
    )
    expect(nameInput).toBeTruthy()
    await nameInput!.setValue('Done pages')

    await pickFieldOption(fieldByLabel(wrapper, '.create-form', 'Layout'), 'LIST')
    await pickFieldOption(fieldByLabel(wrapper, '.filter-row', 'Property'), 'status')
    await flushPromises()
    await pickFieldOption(fieldByLabel(wrapper, '.filter-row', 'Operator'), 'EQ')
    await pickFieldOption(fieldByLabel(wrapper, '.filter-row', 'Value'), 'done')

    await wrapper.get('.create-form').trigger('submit.prevent')
    await flushPromises()

    expect(createView).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Done pages',
      type: 'LIST',
      filters: [{ key: 'status', op: 'EQ', value: 'done' }],
    }))
  })

  it('appends cursor pages and retries a failed load more request', async () => {
    const wrapper = mount(ViewsPage, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    runView
      .mockResolvedValueOnce({ data: { items: [{ page: { id: 'p1', slug: 'one', title: 'One' } }], nextCursor: 'cursor-1' } })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { items: [{ page: { id: 'p2', slug: 'two', title: 'Two' } }], nextCursor: null } })

    await wrapper.get('.library-list .link-btn').trigger('click')
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
