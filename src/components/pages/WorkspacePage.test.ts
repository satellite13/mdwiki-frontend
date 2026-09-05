import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia } from 'pinia'
import WorkspacePage from './WorkspacePage.vue'
import { i18n } from '@/i18n'

const auth = { isEditor: false }
const updatePage = vi.fn()
const replace = vi.fn()
const fetchTree = vi.fn()
const onContentChange = vi.fn()
const onEditorSave = vi.fn()
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
  getPageSections: vi.fn().mockResolvedValue({ data: { slug: 'old-slug', updatedAt: '', sections: [] } })
}))
vi.mock('@/composables/useWorkspacePage', () => ({
  useWorkspacePage: () => ({
    page,
    backlinks: ref([]),
    loading: ref(false),
    title: ref('Title'),
    content: ref('# Title'),
    showGraph: ref(false),
    saveStatus: ref('idle'),
    saveError: ref(null),
    isDirty: () => false,
    onContentChange,
    onTitleInput: vi.fn(),
    onEditorSave,
    doSave: vi.fn(),
    clearSaveError: vi.fn(),
    toggleGraph: vi.fn(),
    loadPage: vi.fn()
  })
}))

function mountPage() {
  return mount(WorkspacePage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        MarkdownEditor: {
          props: ['readonly'],
          emits: ['update:modelValue', 'save'],
          template: '<div class="markdown-editor-stub" :data-readonly="String(readonly)"><button class="emit-change" @click="$emit(\'update:modelValue\', \'changed\')" /><button class="emit-save" @click="$emit(\'save\')" /></div>'
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
    auth.isEditor = false
    page.value = { ...page.value, slug: 'old-slug', updatedAt: '2026-09-05T10:00:00Z' }
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
  })
})
