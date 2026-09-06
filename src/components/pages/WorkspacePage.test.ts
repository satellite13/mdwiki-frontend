import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import WorkspacePage from './WorkspacePage.vue'
import { i18n } from '@/i18n'

const auth = { isEditor: false }
const updatePage = vi.fn()
const replace = vi.fn()
const fetchTree = vi.fn()
const onContentChange = vi.fn()
const onEditorSave = vi.fn()
const flushPendingSave = vi.fn()
const loadPage = vi.fn()
const getPageSections = vi.fn()
const getFavorites = vi.fn()
const addFavorite = vi.fn()
const removeFavorite = vi.fn()
const materializeStableLink = vi.fn()
const copyTextToClipboard = vi.fn()
const content = ref('# Title')
const page = ref({
  id: '1',
  slug: 'old-slug',
  title: 'Title',
  contentMd: '# Title',
  tags: [],
  locked: false,
  createdBy: 'user',
  updatedBy: 'user',
  createdAt: '2026-09-05T10:00:00Z',
  updatedAt: '2026-09-05T10:00:00Z'
})

vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/folders', () => ({ useFolderStore: () => ({ fetchTree }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace })
}))
vi.mock('@/api/pages', () => ({
  updatePage: (...args: unknown[]) => updatePage(...args),
  getPageSections: (...args: unknown[]) => getPageSections(...args),
  materializeStableLink: (...args: unknown[]) => materializeStableLink(...args)
}))
vi.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: (...args: unknown[]) => copyTextToClipboard(...args)
}))
vi.mock('@/api/library', () => ({
  getFavorites: (...args: unknown[]) => getFavorites(...args),
  addFavorite: (...args: unknown[]) => addFavorite(...args),
  removeFavorite: (...args: unknown[]) => removeFavorite(...args)
}))
vi.mock('@/composables/useWorkspacePage', () => ({
  useWorkspacePage: () => ({
    page,
    backlinks: ref([]),
    loading: ref(false),
    title: ref('Title'),
    content,
    showGraph: ref(false),
    saveStatus: ref('idle'),
    saveError: ref(null),
    isDirty: () => false,
    onContentChange,
    onTitleInput: vi.fn(),
    onEditorSave,
    doSave: vi.fn(),
    flushPendingSave,
    clearSaveError: vi.fn(),
    toggleGraph: vi.fn(),
    loadPage
  })
}))

function mountPage() {
  return mount(WorkspacePage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        MarkdownEditor: {
          props: ['readonly', 'sectionMap', 'copySectionLink'],
          emits: ['update:modelValue', 'save'],
          template: '<div class="markdown-editor-stub" :data-readonly="String(readonly)" :data-section-slug="sectionMap?.slug"><button class="emit-change" @click="$emit(\'update:modelValue\', \'changed\')" /><button class="emit-save" @click="$emit(\'save\')" /><button class="copy-computed" @click="copySectionLink(\'same-2\')" /><button class="copy-stable" @click="copySectionLink(\'same-2\', \'sec_id\')" /></div>'
        },
        GraphPanel: true,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('WorkspacePage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPageSections.mockReset()
    updatePage.mockReset()
    flushPendingSave.mockReset()
    auth.isEditor = false
    page.value = { ...page.value, slug: 'old-slug', updatedAt: '2026-09-05T10:00:00Z' }
    content.value = '# Title'
    flushPendingSave.mockResolvedValue(true)
    getPageSections.mockResolvedValue({
      data: { slug: 'old-slug', updatedAt: '2026-09-05T10:00:00Z', sections: [] }
    })
    getFavorites.mockResolvedValue({ data: [] })
    addFavorite.mockResolvedValue(undefined)
    removeFavorite.mockResolvedValue(undefined)
    materializeStableLink.mockReset()
    copyTextToClipboard.mockResolvedValue(true)
  })

  it('reader copies computed or existing stable URL without mutation', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.copy-computed').trigger('click')
    await wrapper.get('.copy-stable').trigger('click')
    await flushPromises()
    expect(materializeStableLink).not.toHaveBeenCalled()
    expect(copyTextToClipboard).toHaveBeenNthCalledWith(1, 'http://localhost/page/old-slug?section=same-2')
    expect(copyTextToClipboard).toHaveBeenNthCalledWith(2, 'http://localhost/page/old-slug?section=sec_id')
  })

  it('editor drains autosave before materializing and copies canonical URL once', async () => {
    auth.isEditor = true
    materializeStableLink.mockResolvedValue({ data: {
      stableId: 'sec_new', sectionKey: 'sec_new', pageSlug: 'old-slug',
      updatedAt: '2026-09-05T10:01:00Z', url: '/page/old-slug?section=sec_new',
      page: { ...page.value, contentMd: '## Same {#sec_new}', updatedAt: '2026-09-05T10:01:00Z' }
    } })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.copy-computed').trigger('click')
    await flushPromises()
    expect(flushPendingSave).toHaveBeenCalledBefore(materializeStableLink)
    expect(materializeStableLink).toHaveBeenCalledWith('old-slug', 'same-2', '2026-09-05T10:00:00Z')
    expect(copyTextToClipboard).toHaveBeenCalledWith('http://localhost/page/old-slug?section=sec_new')
  })

  it('renders READER workspace without mutation controls and passes readonly', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.title-input').exists()).toBe(false)
    expect(wrapper.find('.lock-btn').exists()).toBe(false)
    expect(wrapper.find('.slug-rename-btn').exists()).toBe(false)
    expect(wrapper.get('.markdown-editor-stub').attributes('data-readonly')).toBe('true')
    await wrapper.get('.emit-change').trigger('click')
    await wrapper.get('.emit-save').trigger('click')
    expect(onContentChange).not.toHaveBeenCalled()
    expect(onEditorSave).not.toHaveBeenCalled()
  })

  it('renames slug explicitly for editors', async () => {
    auth.isEditor = true
    updatePage.mockResolvedValue({ data: { ...page.value, slug: 'new-slug' } })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.slug-rename-btn').trigger('click')
    await wrapper.get('.slug-rename-input').setValue('New Slug')
    await wrapper.get('.slug-rename-form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePage).toHaveBeenCalledWith('old-slug', {
      slug: 'new-slug',
      expectedUpdatedAt: '2026-09-05T10:00:00Z'
    })
    expect(replace).toHaveBeenCalledWith('/page/new-slug')
    expect(fetchTree).toHaveBeenCalled()
    expect(loadPage).not.toHaveBeenCalled()
  })

  it('flushes dirty content before renaming the slug', async () => {
    auth.isEditor = true
    flushPendingSave.mockImplementation(async () => {
      await updatePage('old-slug', { contentMd: '# Changed' })
      page.value = { ...page.value, contentMd: '# Changed', updatedAt: '2026-09-05T10:01:00Z' }
      return true
    })
    updatePage
      .mockResolvedValueOnce({ data: { ...page.value, contentMd: '# Changed' } })
      .mockResolvedValueOnce({ data: { ...page.value, slug: 'new-slug', contentMd: '# Changed' } })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('.slug-rename-btn').trigger('click')
    await wrapper.get('.slug-rename-input').setValue('new-slug')
    await wrapper.get('.slug-rename-form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePage).toHaveBeenNthCalledWith(1, 'old-slug', { contentMd: '# Changed' })
    expect(updatePage).toHaveBeenNthCalledWith(2, 'old-slug', {
      slug: 'new-slug',
      expectedUpdatedAt: '2026-09-05T10:01:00Z'
    })
  })

  it('does not rename or discard local content when the pending save fails', async () => {
    auth.isEditor = true
    content.value = '# Unsaved'
    flushPendingSave.mockResolvedValue(false)
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('.slug-rename-btn').trigger('click')
    await wrapper.get('.slug-rename-input').setValue('new-slug')
    await wrapper.get('.slug-rename-form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePage).not.toHaveBeenCalled()
    expect(loadPage).not.toHaveBeenCalled()
    expect(content.value).toBe('# Unsaved')
    expect(wrapper.find('.slug-rename-form').exists()).toBe(true)
  })

  it('ignores a stale section map after navigating to another page', async () => {
    let resolveOld!: (value: unknown) => void
    let resolveNew!: (value: unknown) => void
    const oldRequest = new Promise((resolve) => { resolveOld = resolve })
    const newRequest = new Promise((resolve) => { resolveNew = resolve })
    getPageSections.mockImplementation((slug: string) =>
      slug === 'new-page' ? newRequest : oldRequest
    )
    const wrapper = mountPage()
    await nextTick()

    page.value = { ...page.value, slug: 'new-page', updatedAt: '2026-09-05T11:00:00Z' }
    await nextTick()
    expect(wrapper.get('.markdown-editor-stub').attributes('data-section-slug')).toBeUndefined()

    resolveNew({ data: { slug: 'new-page', updatedAt: '2026-09-05T11:00:00Z', sections: [] } })
    await flushPromises()
    expect(wrapper.get('.markdown-editor-stub').attributes('data-section-slug')).toBe('new-page')

    resolveOld({ data: { slug: 'old-slug', updatedAt: '2026-09-05T10:00:00Z', sections: [] } })
    await flushPromises()
    expect(wrapper.get('.markdown-editor-stub').attributes('data-section-slug')).toBe('new-page')
  })

  it('does not roll back favorite state on a different page', async () => {
    let rejectOld!: (reason: unknown) => void
    addFavorite.mockReturnValue(new Promise((_resolve, reject) => { rejectOld = reject }))
    getFavorites.mockResolvedValue({ data: [{ page: { id: '2' } }] })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.favorite-btn').trigger('click')
    page.value = { ...page.value, id: '2', slug: 'new-page' }
    await flushPromises()
    rejectOld(new Error('failed'))
    await flushPromises()

    expect(wrapper.get('.favorite-btn').attributes('aria-pressed')).toBe('true')
  })

  it('optimistically toggles favorite and rolls back on failure', async () => {
    let reject!: (reason: unknown) => void
    addFavorite.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('.favorite-btn').trigger('click')
    expect(wrapper.get('.favorite-btn').attributes('aria-pressed')).toBe('true')
    reject(new Error('failed'))
    await flushPromises()
    expect(wrapper.get('.favorite-btn').attributes('aria-pressed')).toBe('false')
  })
})
