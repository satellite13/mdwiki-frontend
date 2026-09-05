import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import InboxPage from './InboxPage.vue'

const auth = { isEditor: true }
const captureText = vi.fn()
const fetchTree = vi.fn()
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/folders', () => ({ useFolderStore: () => ({ fetchTree }) }))
vi.mock('@/api/captures', () => ({
  captureText: (...args: unknown[]) => captureText(...args),
  captureUrl: vi.fn(),
  captureImage: vi.fn()
}))

function mountPage() {
  return mount(InboxPage, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  })
}

describe('InboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.isEditor = true
  })

  it('retains text draft after an error', async () => {
    captureText.mockRejectedValue(new Error('failed'))
    const wrapper = mountPage()
    await wrapper.get('textarea').setValue('draft')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('draft')
  })

  it('clears draft only after success and refreshes tree', async () => {
    captureText.mockResolvedValue({ data: { kind: 'text', page: { slug: 'capture', title: 'Capture' } } })
    const wrapper = mountPage()
    await wrapper.get('textarea').setValue('draft')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(fetchTree).toHaveBeenCalledWith(true)
  })

  it('shows explanation without submit controls for readers', () => {
    auth.isEditor = false
    const wrapper = mountPage()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Editor')
  })
})
