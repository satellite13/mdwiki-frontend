import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import UnlinkedMentionsPage from './UnlinkedMentionsPage.vue'

const route = reactive({ name: 'unlinked-mentions', query: { target: 'target' as string | undefined } })
const replace = vi.fn()
const auth = { isEditor: false }
const getUnlinkedMentions = vi.fn()
const linkUnlinkedMention = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/folders', () => ({ useFolderStore: () => ({ fetchTree: vi.fn() }) }))
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('li button').trigger('click')
    expect(linkUnlinkedMention).toHaveBeenCalled()
    await wrapper.get('select').setValue('')
    await wrapper.get('select').trigger('change')
    expect(replace).toHaveBeenCalledWith({ query: {} })
  })
})
