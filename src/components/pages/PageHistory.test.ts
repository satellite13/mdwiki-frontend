import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import PageHistory from './PageHistory.vue'
import { i18n } from '@/i18n'
import { getDocumentByTestId } from '@/test/dom'
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
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a v-bind="$attrs"><slot /></a>' }
      }
    }
  })
}

describe('PageHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks(); route.query = {}; route.params.slug = 'note'; auth.isEditor = false
    listRevisions.mockResolvedValue({ data: summaries })
    getRevision.mockImplementation((_slug: string, no: number) => Promise.resolve({
      data: { ...summaries.find(r => r.revisionNo === no), id: String(no), contentMd: `line ${no}` }
    }))
    confirm.mockResolvedValue(true)
  })

  it('renders back link as a secondary button', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const back = wrapper.get('a.btn-secondary.history-back')
    expect(back.text()).toBe(i18n.global.t('history.back'))
    expect(back.classes()).toContain('btn-secondary')
  })

  it('canonicalizes latest comparison, loads two snapshots, and hides restore for reader', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(replace).toHaveBeenCalledWith({ query: { from: '2', to: '3' } })
    expect(getRevision).toHaveBeenCalledWith('note', 2)
    expect(getRevision).toHaveBeenCalledWith('note', 3)
    expect(wrapper.find('.selectors').exists()).toBe(true)
    expect(wrapper.find('.restore-action button').exists()).toBe(false)
  })

  it('renders localized delete and trash restore operations', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const beforeSelect = wrapper.findAll('.selectors .app-select')[0]!
    await beforeSelect.get('[data-testid="app-select-trigger"]').trigger('click')
    const list = getDocumentByTestId('app-select-list')
    expect(list.text()).toContain('Restored from trash')
    expect(list.text()).toContain('Deleted')
  })

  it('labels restore with the From revision number and keeps hint behind HelpTip', async () => {
    auth.isEditor = true
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.get('.restore-action button').text()).toContain('Restore revision #2')
    expect(wrapper.find('.restore-hint').exists()).toBe(false)
    const restoreHelp = wrapper.find('.field-label-row .help-tip-trigger')
    expect(restoreHelp.exists()).toBe(true)
    await restoreHelp.trigger('click')
    expect(document.body.textContent).toContain('The button restores the “From” revision content')
  })

  it('keeps selection and offers reload on restore conflict', async () => {
    auth.isEditor = true
    getPage.mockResolvedValue({ data: { updatedAt: 'now' } })
    restoreRevision.mockRejectedValue({ isAxiosError: true, response: { status: 409 } })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.restore-action button').trigger('click')
    await flushPromises()
    expect(restoreRevision).toHaveBeenCalledWith('note', 2, 'now')
    expect(wrapper.text()).toContain('The page changed')
    expect(wrapper.findAll('.selectors .app-select')[0]!.text()).toContain('#2')
  })

  it('ignores delayed responses from the previous slug', async () => {
    let resolveOld!: (value: { data: RevisionSummary[] }) => void
    const oldRequest = new Promise<{ data: RevisionSummary[] }>(resolve => { resolveOld = resolve })
    const fresh = summaries.map(item => ({ ...item, title: 'Fresh B' }))
    listRevisions
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce({ data: fresh })
    const wrapper = mountPage()
    route.params.slug = 'fresh-b'
    await flushPromises()
    resolveOld({ data: summaries.map(item => ({ ...item, title: 'Stale A' })) })
    await flushPromises()

    expect(listRevisions).toHaveBeenCalledWith('fresh-b', { limit: 50 })
    expect(getRevision).toHaveBeenCalledWith('fresh-b', 2)
    const beforeSelect = wrapper.findAll('.selectors .app-select')[0]!
    await beforeSelect.get('[data-testid="app-select-trigger"]').trigger('click')
    expect(getDocumentByTestId('app-select-option-3').text()).toContain('Restored from trash')
    expect(getRevision).not.toHaveBeenCalledWith('note', expect.any(Number))
  })
})
