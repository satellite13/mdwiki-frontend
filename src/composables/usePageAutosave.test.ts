import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { i18n } from '@/i18n'
import { usePageAutosave } from '@/composables/usePageAutosave'
import type { Page } from '@/types'
import { AxiosError, AxiosHeaders } from 'axios'

const mockUpdatePage = vi.fn()

vi.mock('@/api/pages', () => ({
  updatePage: (...args: unknown[]) => mockUpdatePage(...args)
}))

function page(overrides: Partial<Page> = {}): Page {
  return {
    id: '1',
    slug: 'note',
    title: 'Note',
    contentMd: 'hello',
    tags: [],
    locked: false,
    createdBy: 'u',
    updatedBy: 'u',
    createdAt: '2026-08-15T09:00:00Z',
    updatedAt: '2026-08-15T10:00:00Z',
    ...overrides
  }
}

function mountAutosave(initial: Page, content = 'hello changed') {
  const state = {
    page: ref<Page | null>(initial),
    title: ref(initial.title),
    content: ref(content),
    lastSavedTitle: ref(initial.title),
    lastSavedContentMd: ref(initial.contentMd || '')
  }
  const fetchTree = vi.fn(async () => {})
  const router = { replace: vi.fn() }
  const Comp = defineComponent({
    setup() {
      return usePageAutosave(state, { router: router as never, fetchTree })
    },
    template: '<div />'
  })
  const wrapper = mount(Comp, { global: { plugins: [i18n] } })
  return { wrapper, state, fetchTree, router }
}

describe('usePageAutosave', () => {
  beforeEach(() => {
    mockUpdatePage.mockReset()
  })

  it('sends expectedUpdatedAt from the loaded page', async () => {
    mockUpdatePage.mockResolvedValue({
      data: page({ contentMd: 'hello changed', updatedAt: '2026-08-15T10:01:00Z' })
    })
    const { wrapper } = mountAutosave(page())

    await wrapper.vm.doSave()
    await flushPromises()

    expect(mockUpdatePage).toHaveBeenCalledWith('note', {
      title: 'Note',
      contentMd: 'hello changed',
      clearFolder: false,
      expectedUpdatedAt: '2026-08-15T10:00:00Z'
    })
  })

  it('keeps dirty state and shows conflict when save is 409', async () => {
    const headers = new AxiosHeaders()
    mockUpdatePage.mockRejectedValue(
      new AxiosError(
        'conflict',
        '409',
        { headers, url: '/pages/note', method: 'put' },
        null,
        {
          status: 409,
          statusText: 'Conflict',
          headers,
          config: { headers, url: '/pages/note' },
          data: { message: "Page 'note' has changed; refresh and retry with current updatedAt" }
        }
      )
    )
    const { wrapper, state } = mountAutosave(page())

    await wrapper.vm.doSave()
    await flushPromises()

    expect(state.lastSavedContentMd.value).toBe('hello')
    expect(state.content.value).toBe('hello changed')
    expect(wrapper.vm.saveError).toContain('changed elsewhere')
  })
})
