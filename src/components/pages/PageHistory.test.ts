import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import PageHistory from './PageHistory.vue'
import { i18n } from '@/i18n'
import type { RevisionSummary } from '@/types'

const route = reactive({ params: { slug: 'note' }, query: {} as Record<string, string> })
const replace = vi.fn()
const listRevisions = vi.fn()
const getRevision = vi.fn()
const getPage = vi.fn()
const restoreRevision = vi.fn()
const confirm = vi.fn()
const auth = reactive({ isEditor: false })

vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/dialog', () => ({ useDialogStore: () => ({ confirm }) }))
vi.mock('@/api/pages', () => ({
  listRevisions: (...args: unknown[]) => listRevisions(...args),
  getRevision: (...args: unknown[]) => getRevision(...args),
  getPage: (...args: unknown[]) => getPage(...args),
  restoreRevision: (...args: unknown[]) => restoreRevision(...args),
}))

const operations = ['RESTORE_TRASH', 'DELETE', 'CREATE'] as const
const summaries: RevisionSummary[] = [3, 2, 1].map((revisionNo, index) => ({
  revisionNo, contentHash: 'x', title: 'Note', slug: 'note', folderId: null,
  operation: operations[index]!, createdByName: 'u', createdAt: '', restoredFromRevisionNo: null,
}))

function mountPage() {
  return mount(PageHistory, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  })
}

describe('PageHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks(); route.query = {}; auth.isEditor = false
    listRevisions.mockResolvedValue({ data: summaries })
    getRevision.mockImplementation((_slug: string, no: number) => Promise.resolve({
      data: { ...summaries.find(r => r.revisionNo === no), id: String(no), contentMd: `line ${no}` }
    }))
    confirm.mockResolvedValue(true)
  })

  it('canonicalizes latest comparison, loads two snapshots, and hides restore for reader', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ query: { from: '2', to: '3' } })
    expect(getRevision).toHaveBeenCalledWith('note', 2)
    expect(getRevision).toHaveBeenCalledWith('note', 3)
    expect(wrapper.find('.selectors').exists()).toBe(true)
    expect(wrapper.find('.selectors > button').exists()).toBe(false)
  })

  it('renders localized delete and trash restore operations', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('select').text()).toContain('Restored from trash')
    expect(wrapper.get('select').text()).toContain('Deleted')
  })

  it('keeps selection and offers reload on restore conflict', async () => {
    auth.isEditor = true
    getPage.mockResolvedValue({ data: { updatedAt: 'now' } })
    restoreRevision.mockRejectedValue({ isAxiosError: true, response: { status: 409 } })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.selectors > button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('The page changed')
    expect(wrapper.findAll('select')[0]!.element.value).toBe('2')
  })
})
