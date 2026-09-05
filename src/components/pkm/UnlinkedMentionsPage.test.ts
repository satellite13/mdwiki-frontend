import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import UnlinkedMentionsPage from './UnlinkedMentionsPage.vue'

const route = reactive({ name: 'unlinked-mentions', query: { target: 'target' as string | undefined } })
const replace = vi.fn()
const auth = { isEditor: false }
const confirm = vi.fn()
const getUnlinkedMentions = vi.fn()
const linkUnlinkedMention = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/folders', () => ({ useFolderStore: () => ({ fetchTree: vi.fn() }) }))
vi.mock('@/stores/dialog', () => ({ useDialogStore: () => ({ confirm }) }))
vi.mock('@/services/pageIndex', () => ({
  getPages: vi.fn().mockResolvedValue([{ id: '1', slug: 'target', title: 'Target' }]),
  invalidatePageIndex: vi.fn()
}))
vi.mock('@/api/linkInsights', () => ({
  getUnlinkedMentions: (...args: unknown[]) => getUnlinkedMentions(...args),
  linkUnlinkedMention: (...args: unknown[]) => linkUnlinkedMention(...args)
}))

function mountPage() {
  return mount(UnlinkedMentionsPage, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        DiscoveryNav: true
      }
    }
  })
}

async function pickAppSelectOption(wrapper: ReturnType<typeof mountPage>, value: string) {
  await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
  const testId = value === '' ? 'app-select-option-empty' : `app-select-option-${value}`
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
}

describe('UnlinkedMentionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.query.target = 'target'
    auth.isEditor = false
    getUnlinkedMentions.mockResolvedValue({ data: [{
      sourceSlug: 'source', sourceTitle: 'Source', snippet: 'Target', startOffset: 0, endOffset: 6,
      expectedUpdatedAt: '2026-09-05T10:00:00Z'
    }] })
    linkUnlinkedMention.mockResolvedValue({})
  })

  it('keeps readers view-only', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('Source')
    expect(wrapper.find('li button').exists()).toBe(false)
  })

  it('links mentions for editors and stores selected target in URL', async () => {
    auth.isEditor = true
    confirm.mockResolvedValue(true)
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('li button').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(linkUnlinkedMention).toHaveBeenCalled()
    await pickAppSelectOption(wrapper, '')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ query: {} })
  })
})
