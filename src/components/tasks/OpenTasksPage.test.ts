import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OpenTasksPage from './OpenTasksPage.vue'
import { i18n } from '@/i18n'

const mockListOpenTasks = vi.fn()
const mockCompleteTask = vi.fn()
const mockPush = vi.fn()
const mockAlert = vi.fn()
const mockConfirm = vi.fn()
const mockInvalidatePageIndex = vi.fn()
const auth = { isEditor: true }

vi.mock('@/api/tasks', () => ({
  listOpenTasks: (...args: unknown[]) => mockListOpenTasks(...args),
  completeTask: (...args: unknown[]) => mockCompleteTask(...args)
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => auth
}))

vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({
    alert: mockAlert,
    confirm: mockConfirm
  })
}))

vi.mock('@/services/pageIndex', () => ({
  invalidatePageIndex: (...args: unknown[]) => mockInvalidatePageIndex(...args)
}))

const tasks = [
  {
    documentId: 'doc-1',
    slug: 'release-notes',
    documentTitle: 'Release notes',
    text: 'Ship task page',
    sourceOffset: 14,
    sourceLine: '- [ ] Ship task page',
    updatedAt: '2026-07-10T10:00:00Z',
    locked: false
  },
  {
    documentId: 'doc-1',
    slug: 'release-notes',
    documentTitle: 'Release notes',
    text: 'Add screenshot',
    sourceOffset: 42,
    sourceLine: '- [ ] Add screenshot',
    updatedAt: '2026-07-10T10:00:00Z',
    locked: false
  },
  {
    documentId: 'doc-2',
    slug: 'roadmap',
    documentTitle: 'Roadmap',
    text: 'Plan v2',
    sourceOffset: 9,
    sourceLine: '- [ ] Plan v2',
    updatedAt: '2026-07-09T10:00:00Z',
    locked: true
  }
]

function mountPage() {
  return mount(OpenTasksPage, {
    global: {
      plugins: [i18n],
      stubs: {
        SkeletonPage: true
      }
    }
  })
}

describe('OpenTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.isEditor = true
    mockListOpenTasks.mockResolvedValue({ data: tasks })
    mockCompleteTask.mockResolvedValue({ data: undefined })
  })

  it('groups tasks by document and opens its page', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Release notes')
    expect(wrapper.text()).toContain('2 tasks')
    expect(wrapper.text()).toContain('Roadmap')
    expect(wrapper.findAll('.group-card')).toHaveLength(2)

    await wrapper.get('[data-testid="open-document-release-notes"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'page', params: { slug: 'release-notes' } })
  })

  it('disables completion for locked documents and non-editors', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect((wrapper.get('[data-testid="complete-9"]').element as HTMLInputElement).disabled).toBe(true)

    auth.isEditor = false
    const readerWrapper = mountPage()
    await flushPromises()
    expect((readerWrapper.get('[data-testid="complete-14"]').element as HTMLInputElement).disabled).toBe(true)
  })

  it('submits a non-empty summary and reloads all tasks', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="complete-14"]').setValue(true)
    expect(wrapper.get('[role="dialog"]').text()).toContain('Complete task')

    await wrapper.get('textarea').setValue('Delivered\nwith tests')
    await wrapper.get('[data-testid="confirm-complete"]').trigger('click')
    await flushPromises()

    expect(mockCompleteTask).toHaveBeenCalledWith({
      documentId: 'doc-1',
      updatedAt: '2026-07-10T10:00:00Z',
      sourceOffset: 14,
      sourceLine: '- [ ] Ship task page',
      summary: 'Delivered\nwith tests'
    })
    expect(mockInvalidatePageIndex).toHaveBeenCalledTimes(1)
    expect(mockListOpenTasks).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('omits an empty summary from the completion payload', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="complete-14"]').setValue(true)
    await wrapper.get('[data-testid="confirm-complete"]').trigger('click')
    await flushPromises()

    expect(mockCompleteTask).toHaveBeenCalledWith({
      documentId: 'doc-1',
      updatedAt: '2026-07-10T10:00:00Z',
      sourceOffset: 14,
      sourceLine: '- [ ] Ship task page'
    })
  })

  it('offers to reload after a completion conflict', async () => {
    mockCompleteTask.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 }
    })
    mockConfirm.mockResolvedValue(true)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="complete-14"]').setValue(true)
    await wrapper.get('[data-testid="confirm-complete"]').trigger('click')
    await flushPromises()

    expect(mockConfirm).toHaveBeenCalledWith(
      'This document changed. Reload the task list before trying again?',
      { confirmLabel: 'Reload' }
    )
    expect(mockListOpenTasks).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(mockAlert).not.toHaveBeenCalled()
  })

  it('alerts on a completion error and keeps the loaded tasks', async () => {
    mockCompleteTask.mockRejectedValue(new Error('Server unavailable'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="complete-14"]').setValue(true)
    await wrapper.get('[data-testid="confirm-complete"]').trigger('click')
    await flushPromises()

    expect(mockAlert).toHaveBeenCalledWith('Server unavailable')
    expect(wrapper.text()).toContain('Ship task page')
    expect(mockListOpenTasks).toHaveBeenCalledTimes(1)
  })

  it('alerts when loading tasks fails', async () => {
    mockListOpenTasks.mockRejectedValue(new Error('Network down'))

    mountPage()
    await flushPromises()

    expect(mockAlert).toHaveBeenCalledWith('Network down')
  })
})
