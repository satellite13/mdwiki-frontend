import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ViewsPage from './ViewsPage.vue'
import { i18n } from '@/i18n'

const listViews = vi.fn()
const getView = vi.fn()
const runView = vi.fn()
const createView = vi.fn()
const updateView = vi.fn()
const deleteView = vi.fn()
const listPropertyDefinitions = vi.fn()
const addFavoriteView = vi.fn()
const removeFavoriteView = vi.fn()
const alert = vi.fn()
const route = reactive({ query: {} as Record<string, string | undefined> })

vi.mock('@/api/views', () => ({
  listViews: (...args: unknown[]) => listViews(...args),
  getView: (...args: unknown[]) => getView(...args),
  runView: (...args: unknown[]) => runView(...args),
  createView: (...args: unknown[]) => createView(...args),
  updateView: (...args: unknown[]) => updateView(...args),
  deleteView: (...args: unknown[]) => deleteView(...args),
}))
vi.mock('@/api/properties', () => ({ listPropertyDefinitions: (...args: unknown[]) => listPropertyDefinitions(...args) }))
vi.mock('@/api/library', () => ({
  addFavoriteView: (...args: unknown[]) => addFavoriteView(...args),
  removeFavoriteView: (...args: unknown[]) => removeFavoriteView(...args),
}))
vi.mock('@/stores/dialog', () => ({ useDialogStore: () => ({ alert }) }))
vi.mock('vue-router', () => ({ useRoute: () => route }))

type SelectHost = { get: (selector: string) => { trigger: (event: string) => Promise<void> | void } }

function getByTestId(testId: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`)
  if (!el) throw new Error(`Unable to find [data-testid="${testId}"]`)
  return new DOMWrapper(el)
}

async function pickFieldOption(field: SelectHost, value: string) {
  await field.get('[data-testid="app-select-trigger"]').trigger('click')
  const testId = value === '' ? 'app-select-option-empty' : `app-select-option-${value}`
  await getByTestId(testId).trigger('click')
}

function fieldByLabel(wrapper: VueWrapper, scope: string, label: string) {
  return wrapper.findAll(`${scope} .field`).find((node) =>
    node.text().includes(label)
  )!
}

function fieldInFilterRow(wrapper: VueWrapper, index: number, label: string) {
  return wrapper.get(`[data-testid="filter-row-${index}"]`).findAll('.field').find((node) =>
    node.text().includes(label)
  )!
}

function mountPage() {
  return mount(ViewsPage, {
    attachTo: document.body,
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
}

describe('ViewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.query = {}
    listPropertyDefinitions.mockResolvedValue({ data: [
      {
        id: 'd1', key: 'status', displayName: 'Status', type: 'SELECT',
        config: { options: ['todo', 'done'] }, required: false, version: 1, createdAt: '', updatedAt: ''
      },
      {
        id: 'd2', key: 'priority', displayName: 'Priority', type: 'NUMBER',
        config: {}, required: false, version: 1, createdAt: '', updatedAt: ''
      },
    ] })
    listViews.mockResolvedValue({ data: [{
      id: 'cards', name: 'Cards', type: 'CARDS', filters: [{ key: 'status', op: 'EQ', value: 'done' }],
      filterMode: 'ALL', sort: [], grouping: null, layout: {}, favorited: false, version: 4, createdAt: '', updatedAt: ''
    }] })
    getView.mockResolvedValue({ data: {
      id: 'cards', name: 'Cards from server', type: 'CARDS',
      filters: [{ key: 'status', op: 'EQ', value: 'done' }], filterMode: 'ALL',
      sort: [], grouping: null, layout: {}, favorited: false, version: 5, createdAt: '', updatedAt: ''
    } })
    runView.mockResolvedValue({ data: { items: [{ page: { id: 'p1', slug: 'one', title: 'One' } }] } })
    createView.mockResolvedValue({ data: { id: 'new' } })
    updateView.mockResolvedValue({ data: { id: 'cards' } })
    addFavoriteView.mockResolvedValue({})
    removeFavoriteView.mockResolvedValue({})
    alert.mockResolvedValue(undefined)
  })

  it('optimistically toggles favorite and rolls back on failure', async () => {
    let reject!: (reason: unknown) => void
    addFavoriteView.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
    const wrapper = mountPage(); await flushPromises()
    const btn = wrapper.get('.favorite-btn')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(addFavoriteView).toHaveBeenCalledWith('cards')
    reject(new Error('failed'))
    await flushPromises()
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(alert).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('runs the view from ?view= deep-link once views load', async () => {
    route.query = { view: 'cards' }
    const wrapper = mountPage()
    await flushPromises()
    expect(runView).toHaveBeenCalledTimes(1)
    expect(runView).toHaveBeenCalledWith('cards')
    wrapper.unmount()
  })

  it('renders card results semantically for a cards view', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.library-list .link-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('article').text()).toContain('One')
    expect(wrapper.text()).toContain('Status = done')
    wrapper.unmount()
  })

  it('creates a view with a property filter', async () => {
    const wrapper = mountPage()
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
      filterMode: 'ALL',
      filters: [{ key: 'status', op: 'EQ', value: 'done' }],
    }))
    wrapper.unmount()
  })

  it('creates two conditions with ANY and can remove a condition', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('[data-testid="view-name"]').setValue('Important or done')
    await pickFieldOption(fieldInFilterRow(wrapper, 0, 'Property'), 'status')
    await flushPromises()
    await pickFieldOption(fieldInFilterRow(wrapper, 0, 'Value'), 'done')
    await wrapper.get('[data-testid="add-filter"]').trigger('click')
    await pickFieldOption(fieldInFilterRow(wrapper, 1, 'Property'), 'priority')
    await flushPromises()
    await fieldInFilterRow(wrapper, 1, 'Value').get('input').setValue('3')
    await wrapper.get('[data-testid="filter-mode-any"]').setValue()

    await wrapper.get('.create-form').trigger('submit.prevent')
    await flushPromises()
    expect(createView).toHaveBeenCalledWith(expect.objectContaining({
      filterMode: 'ANY',
      filters: [
        { key: 'status', op: 'EQ', value: 'done' },
        { key: 'priority', op: 'EQ', value: 3 },
      ],
    }))

    await wrapper.get('[data-testid="add-filter"]').trigger('click')
    await wrapper.get('[data-testid="remove-filter-1"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="filter-row-"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('resets only the changed condition and summarizes every condition', async () => {
    listViews.mockResolvedValueOnce({ data: [{
      id: 'cards', name: 'Cards', type: 'CARDS', filterMode: 'ALL',
      filters: [
        { key: 'status', op: 'EQ', value: 'done' },
        { key: 'priority', op: 'GTE', value: 3 },
      ],
      sort: [], grouping: null, layout: {}, favorited: false, version: 4, createdAt: '', updatedAt: ''
    }] })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('Status = done AND Priority ≥ 3')

    await wrapper.get('[data-testid="add-filter"]').trigger('click')
    await pickFieldOption(fieldInFilterRow(wrapper, 1, 'Property'), 'priority')
    await flushPromises()
    await fieldInFilterRow(wrapper, 1, 'Value').get('input').setValue('7')
    await pickFieldOption(fieldInFilterRow(wrapper, 0, 'Property'), 'priority')
    await flushPromises()
    expect((fieldInFilterRow(wrapper, 0, 'Value').get('input').element as HTMLInputElement).value).toBe('')
    expect((fieldInFilterRow(wrapper, 1, 'Value').get('input').element as HTMLInputElement).value).toBe('7')
    wrapper.unmount()
  })

  it('edits a view through the shared form with optimistic locking and supports cancel', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('[data-testid="edit-view-cards"]').trigger('click')
    expect((wrapper.get('[data-testid="view-name"]').element as HTMLInputElement).value).toBe('Cards')
    await wrapper.get('[data-testid="view-name"]').setValue('Updated cards')
    await wrapper.get('.create-form').trigger('submit.prevent')
    await flushPromises()
    expect(updateView).toHaveBeenCalledWith('cards', expect.objectContaining({
      name: 'Updated cards',
      type: 'CARDS',
      filterMode: 'ALL',
      filters: [{ key: 'status', op: 'EQ', value: 'done' }],
      expectedVersion: 4,
    }))
    expect((wrapper.get('[data-testid="view-name"]').element as HTMLInputElement).value).toBe('')

    await wrapper.get('[data-testid="edit-view-cards"]').trigger('click')
    await wrapper.get('[data-testid="cancel-edit"]').trigger('click')
    expect((wrapper.get('[data-testid="view-name"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="cancel-edit"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the edit draft when an optimistic-lock conflict occurs', async () => {
    updateView.mockRejectedValueOnce(Object.assign(new Error('conflict'), {
      isAxiosError: true,
      response: { status: 409 },
    }))
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('[data-testid="edit-view-cards"]').trigger('click')
    await wrapper.get('[data-testid="view-name"]').setValue('My draft')
    await wrapper.get('.create-form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('changed elsewhere')
    expect((wrapper.get('[data-testid="view-name"]').element as HTMLInputElement).value).toBe('My draft')
    expect(wrapper.find('[data-testid="cancel-edit"]').exists()).toBe(true)
    expect(getView).toHaveBeenCalledWith('cards')

    await wrapper.get('.create-form').trigger('submit.prevent')
    await flushPromises()
    expect(updateView).toHaveBeenLastCalledWith('cards', expect.objectContaining({
      name: 'My draft',
      expectedVersion: 5,
    }))
    wrapper.unmount()
  })

  it('appends cursor pages and retries a failed load more request', async () => {
    const wrapper = mountPage()
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
    wrapper.unmount()
  })
})
