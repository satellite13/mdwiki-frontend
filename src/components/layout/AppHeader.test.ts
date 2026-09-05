import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppHeader from './AppHeader.vue'
import { i18n } from '@/i18n'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ name: 'workspace', path: '/', params: {}, query: {} })
}))
vi.mock('@/api/sync', () => ({
  postWikiFullSync: vi.fn()
}))

describe('AppHeader search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('navigates to canonical hybrid search URL', async () => {
    const wrapper = mount(AppHeader, {
      global: {
        plugins: [createPinia(), i18n],
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          ThemeModeIcon: true,
          MdwikiMark: true
        }
      }
    })

    await wrapper.get('.search-form input').setValue('knowledge')
    await wrapper.get('.search-form').trigger('submit.prevent')

    expect(push).toHaveBeenCalledWith({
      name: 'search',
      query: { q: 'knowledge', mode: 'hybrid' }
    })
  })
})
