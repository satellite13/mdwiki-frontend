import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { usePageLoader } from './usePageLoader'

const getPage = vi.fn()
const createPage = vi.fn()
const updatePage = vi.fn()
const getBacklinks = vi.fn()

vi.mock('@/api/pages', () => ({
  getPage: (...args: unknown[]) => getPage(...args),
  createPage: (...args: unknown[]) => createPage(...args),
  updatePage: (...args: unknown[]) => updatePage(...args),
  getBacklinks: (...args: unknown[]) => getBacklinks(...args)
}))
vi.mock('@/services/pageIndex', () => ({
  getPages: vi.fn().mockResolvedValue([]),
  slugCandidatesForNavigation: (slug: string) => [slug]
}))
vi.mock('@/stores/dialog', () => ({
  useDialogStore: () => ({ alert: vi.fn() })
}))

function notFound() {
  return new AxiosError('not found', undefined, undefined, undefined, {
    status: 404,
    statusText: 'Not Found',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {}
  })
}

describe('usePageLoader capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPage.mockRejectedValue(notFound())
    createPage.mockResolvedValue({ data: null })
  })

  it('leaves a missing page empty for readers without any mutation', async () => {
    let loadPage!: (slug: string) => Promise<void>
    const page = ref(null)
    const loading = ref(false)
    mount(defineComponent({
      setup() {
        const loader = usePageLoader(
          {
            page,
            backlinks: ref([]),
            loading,
            title: ref(''),
            content: ref(''),
            lastSavedTitle: ref(''),
            lastSavedContentMd: ref('')
          },
          {
            router: { replace: vi.fn() } as never,
            stopPendingSave: vi.fn(),
            canCreate: false
          }
        )
        loadPage = loader.loadPage
        return () => null
      }
    }), { global: { plugins: [i18n] } })

    await loadPage('missing')

    expect(page.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(createPage).not.toHaveBeenCalled()
    expect(updatePage).not.toHaveBeenCalled()
  })
})
