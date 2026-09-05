import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import DailyNotePage from './DailyNotePage.vue'

const route = reactive({ params: { date: '2026-09-01' as string | undefined } })
const replace = vi.fn()
const getDailyNote = vi.fn()
const putDailyNote = vi.fn()
const auth = { isEditor: true }
enableAutoUnmount(afterEach)

vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/api/dailyNotes', () => ({
  getDailyNote: (...args: unknown[]) => getDailyNote(...args),
  putDailyNote: (...args: unknown[]) => putDailyNote(...args)
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function notFound() {
  return new AxiosError('missing', undefined, undefined, undefined, {
    status: 404, statusText: 'Not Found', headers: {}, config: { headers: new AxiosHeaders() }, data: {}
  })
}

describe('DailyNotePage stale requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.params.date = '2026-09-01'
    auth.isEditor = true
  })

  it('redirects an existing daily note without PUT', async () => {
    getDailyNote.mockResolvedValue({ data: { page: { slug: 'existing' } } })
    mount(DailyNotePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/page/existing')
    expect(putDailyNote).not.toHaveBeenCalled()
  })

  it('creates a missing note for editors', async () => {
    getDailyNote.mockRejectedValue(notFound())
    putDailyNote.mockResolvedValue({ data: { page: { slug: 'created' } } })
    mount(DailyNotePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(putDailyNote).toHaveBeenCalledWith('2026-09-01', expect.any(AbortSignal))
    expect(replace).toHaveBeenCalledWith('/page/created')
  })

  it('shows an empty state for readers without PUT', async () => {
    auth.isEditor = false
    getDailyNote.mockRejectedValue(notFound())
    const wrapper = mount(DailyNotePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(putDailyNote).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Reader')
  })

  it('does not create or redirect an old date after navigation', async () => {
    const oldRequest = deferred<never>()
    const newRequest = deferred<{ data: { page: { slug: string } } }>()
    getDailyNote.mockImplementation((date: string) =>
      date === '2026-09-01' ? oldRequest.promise : newRequest.promise
    )
    mount(DailyNotePage, { global: { plugins: [i18n] } })
    await nextTick()
    route.params.date = '2026-09-02'
    await nextTick()
    newRequest.resolve({ data: { page: { slug: 'daily-new' } } })
    await flushPromises()
    oldRequest.reject(notFound())
    await flushPromises()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/page/daily-new')
    expect(putDailyNote).not.toHaveBeenCalledWith('2026-09-01', expect.anything())
  })
})
