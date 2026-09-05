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

  it('exposes connected roving tabs and exact raster accept list', async () => {
    const wrapper = mountPage()
    const textTab = wrapper.get('#capture-tab-text')
    expect(textTab.attributes('aria-controls')).toBe('capture-panel-text')
    expect(textTab.attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#capture-panel-text').attributes('aria-labelledby')).toBe('capture-tab-text')
    expect(wrapper.get('#capture-panel-url').attributes('hidden')).toBeDefined()
    expect(wrapper.get('#capture-panel-image').attributes('hidden')).toBeDefined()

    await textTab.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.get('#capture-tab-url').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#capture-panel-url').attributes('hidden')).toBeUndefined()
    await wrapper.get('#capture-tab-image').trigger('click')
    expect(wrapper.get('#capture-panel-image').attributes('role')).toBe('tabpanel')
    expect(wrapper.get('input[type=file]').attributes('accept'))
      .toBe('.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp')
  })
})
