import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminTrashPage from './AdminTrashPage.vue'
import { i18n } from '@/i18n'

const mockListDeletedPages = vi.fn()
const mockRestorePage = vi.fn()
const mockDeletePage = vi.fn()
const mockAlert = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@/api/pages', () => ({
  listDeletedPages: (...args: unknown[]) => mockListDeletedPages(...args),
  restorePage: (...args: unknown[]) => mockRestorePage(...args),
  deletePage: (...args: unknown[]) => mockDeletePage(...args)
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: mockAlert,
    confirm: mockConfirm
  })
}))

describe('AdminTrashPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListDeletedPages.mockResolvedValue({
      data: [
        {
          id: '1',
          slug: 'gone',
          title: 'Gone',
          tags: [],
          folderId: null,
          updatedAt: '2026-07-29T10:00:00Z',
          deletedAt: '2026-07-29T14:22:00Z'
        }
      ]
    })
    mockRestorePage.mockResolvedValue({ data: {} })
    mockDeletePage.mockResolvedValue(undefined)
    mockConfirm.mockResolvedValue(true)
  })

  it('lists deleted pages and restores on click', async () => {
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Gone')
    expect(wrapper.text()).toContain('gone')

    await wrapper.get('button.btn-restore').trigger('click')
    await flushPromises()

    expect(mockRestorePage).toHaveBeenCalledWith('gone')
    expect(mockListDeletedPages).toHaveBeenCalledTimes(2)
  })

  it('hard-deletes after confirm', async () => {
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()

    await wrapper.get('button.btn-hard-delete').trigger('click')
    await flushPromises()

    expect(mockConfirm).toHaveBeenCalled()
    expect(mockDeletePage).toHaveBeenCalledWith('gone', 'hard')
  })

  it('shows empty state when trash is empty', async () => {
    mockListDeletedPages.mockResolvedValue({ data: [] })
    const wrapper = mount(AdminTrashPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { template: '<a><slot /></a>' } }
      }
    })
    await flushPromises()
    expect(wrapper.text()).toMatch(/Нет удалённых|No deleted/i)
  })
})
