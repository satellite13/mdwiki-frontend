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

    const ok = await wrapper.vm.doSave()
    await flushPromises()

    expect(ok).toBe(false)
    expect(state.lastSavedContentMd.value).toBe('hello')
    expect(state.content.value).toBe('hello changed')
    expect(wrapper.vm.saveError).toContain('changed elsewhere')
  })

  it('returns true after a successful save', async () => {
    mockUpdatePage.mockResolvedValue({
      data: page({ contentMd: 'hello changed', updatedAt: '2026-08-15T10:01:00Z' })
    })
    const { wrapper } = mountAutosave(page())

    const ok = await wrapper.vm.doSave()
    await flushPromises()

    expect(ok).toBe(true)
  })

  it('flushes an in-flight save and returns its result without retrying', async () => {
    let resolveSave!: (value: unknown) => void
    mockUpdatePage.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    const { wrapper } = mountAutosave(page())

    const save = wrapper.vm.doSave()
    await flushPromises()
    let flushed = false
    const flush = wrapper.vm.flushPendingSave().then((value: boolean) => {
      flushed = true
      return value
    })
    await flushPromises()
    expect(flushed).toBe(false)
    expect(mockUpdatePage).toHaveBeenCalledTimes(1)

    resolveSave({
      data: page({ contentMd: 'hello changed', updatedAt: '2026-08-15T10:01:00Z' })
    })
    expect(await save).toBe(true)
    expect(await flush).toBe(true)
    expect(mockUpdatePage).toHaveBeenCalledTimes(1)
  })

  it('reports a failed in-flight save to a flush caller', async () => {
    let rejectSave!: (error: Error) => void
    mockUpdatePage.mockReturnValue(new Promise((_, reject) => { rejectSave = reject }))
    const { wrapper, state } = mountAutosave(page())

    void wrapper.vm.doSave()
    await flushPromises()
    const flush = wrapper.vm.flushPendingSave()
    rejectSave(new Error('save failed'))

    expect(await flush).toBe(false)
    expect(state.content.value).toBe('hello changed')
    expect(state.lastSavedContentMd.value).toBe('hello')
    expect(mockUpdatePage).toHaveBeenCalledTimes(1)
  })

  it('drains edits made during an in-flight save through a second snapshot', async () => {
    let resolveFirst!: (value: unknown) => void
    let resolveSecond!: (value: unknown) => void
    mockUpdatePage
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve }))
    const { wrapper, state } = mountAutosave(page(), 'first edit')

    void wrapper.vm.doSave()
    await flushPromises()
    wrapper.vm.onContentChange('second edit')
    const flush = wrapper.vm.flushPendingSave()

    resolveFirst({
      data: page({ contentMd: 'first edit', updatedAt: '2026-08-15T10:01:00Z' })
    })
    await flushPromises()
    expect(mockUpdatePage).toHaveBeenNthCalledWith(2, 'note', {
      title: 'Note',
      contentMd: 'second edit',
      clearFolder: false,
      expectedUpdatedAt: '2026-08-15T10:01:00Z'
    })

    let drained = false
    void flush.then(() => { drained = true })
    await flushPromises()
    expect(drained).toBe(false)
    resolveSecond({
      data: page({ contentMd: 'second edit', updatedAt: '2026-08-15T10:02:00Z' })
    })

    expect(await flush).toBe(true)
    expect(state.content.value).toBe('second edit')
    expect(state.lastSavedContentMd.value).toBe('second edit')
  })

  it('stops draining after a conflict and keeps the newest local edit dirty', async () => {
    let resolveFirst!: (value: unknown) => void
    mockUpdatePage
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockRejectedValueOnce(new Error('conflict'))
    const { wrapper, state } = mountAutosave(page(), 'first edit')

    void wrapper.vm.doSave()
    await flushPromises()
    wrapper.vm.onContentChange('second edit')
    const flush = wrapper.vm.flushPendingSave()
    resolveFirst({
      data: page({ contentMd: 'first edit', updatedAt: '2026-08-15T10:01:00Z' })
    })

    expect(await flush).toBe(false)
    expect(mockUpdatePage).toHaveBeenCalledTimes(2)
    expect(state.content.value).toBe('second edit')
    expect(state.lastSavedContentMd.value).toBe('first edit')
  })

  it('adopts a canonical API response when the user did not edit during the request', async () => {
    const { wrapper, state } = mountAutosave(page(), 'formatted content')
    state.title.value = '  Typed title  '
    mockUpdatePage
      .mockResolvedValueOnce({
        data: page({
          title: 'Typed title',
          contentMd: 'formatted content',
          updatedAt: '2026-08-15T10:01:00Z'
        })
      })
      .mockRejectedValueOnce(new Error('drain repeated without progress'))

    const result = await wrapper.vm.flushPendingSave()

    expect(result).toBe(true)
    expect(state.title.value).toBe('Typed title')
    expect(state.content.value).toBe('formatted content')
    expect(wrapper.vm.isDirty()).toBe(false)
    expect(mockUpdatePage).toHaveBeenCalledTimes(1)
  })

  it('preserves a concurrent title edit and drains it as the next snapshot', async () => {
    let resolveFirst!: (value: unknown) => void
    let resolveSecond!: (value: unknown) => void
    mockUpdatePage
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve }))
    const { wrapper, state } = mountAutosave(page(), 'changed content')
    state.title.value = 'First title'

    void wrapper.vm.doSave()
    await flushPromises()
    wrapper.vm.onTitleInput({ target: { value: 'Second title' } } as unknown as Event)
    const flush = wrapper.vm.flushPendingSave()
    resolveFirst({
      data: page({
        title: 'Canonical first',
        contentMd: 'changed content',
        updatedAt: '2026-08-15T10:01:00Z'
      })
    })
    await flushPromises()

    expect(state.title.value).toBe('Second title')
    expect(mockUpdatePage).toHaveBeenNthCalledWith(2, 'note', {
      title: 'Second title',
      contentMd: 'changed content',
      clearFolder: false,
      expectedUpdatedAt: '2026-08-15T10:01:00Z'
    })
    resolveSecond({
      data: page({
        title: 'Canonical second',
        contentMd: 'changed content',
        updatedAt: '2026-08-15T10:02:00Z'
      })
    })

    expect(await flush).toBe(true)
    expect(state.title.value).toBe('Canonical second')
    expect(wrapper.vm.isDirty()).toBe(false)
  })
})
