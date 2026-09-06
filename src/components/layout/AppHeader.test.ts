import { createPinia } from 'pinia'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppHeader from './AppHeader.vue'
import { i18n, setLocale } from '@/i18n'

const push = vi.fn()
enableAutoUnmount(afterEach)

const route = reactive({
  name: 'views',
  path: '/views',
  params: {} as Record<string, string>,
  query: {} as Record<string, string>
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => route
}))
vi.mock('@/api/sync', () => ({
  postWikiFullSync: vi.fn()
}))

function mountHeader() {
  return mount(AppHeader, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ThemeModeIcon: true,
        MdwikiMark: true
      }
    }
  })
}

describe('AppHeader search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    route.name = 'views'
    route.path = '/views'
    route.params = {}
    route.query = {}
    setLocale('en')
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  })

  it('navigates to canonical hybrid search URL', async () => {
    const wrapper = mountHeader()

    await wrapper.get('.search-form input').setValue('knowledge')
    await wrapper.get('.search-form').trigger('submit.prevent')

    expect(push).toHaveBeenCalledWith({
      name: 'search',
      query: { q: 'knowledge', mode: 'hybrid' }
    })
  })

  it('handles quick capture shortcut outside inputs and removes listener', async () => {
    localStorage.setItem('token', 'token')
    localStorage.setItem('username', 'editor')
    localStorage.setItem('role', 'EDITOR')
    const wrapper = mountHeader()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', shiftKey: true, metaKey: true, bubbles: true }))
    wrapper.get('.search-form input').element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'N', shiftKey: true, metaKey: true, bubbles: true })
    )
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/inbox')
    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', shiftKey: true, metaKey: true }))
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('renders every desktop navigation icon', () => {
    const wrapper = mountHeader()
    const mappings = [
      ['daily', 'today'],
      ['recent', 'history'],
      ['favorites', 'star'],
      ['search-library', 'saved_search'],
      ['views', 'view_list'],
      ['tasks', 'task_alt'],
      ['attachments', 'attach_file'],
      ['discovery', 'explore'],
      ['graph', 'hub']
    ] as const

    expect(wrapper.findAll('.header-nav .nav-link')).toHaveLength(mappings.length)
    for (const [key, icon] of mappings) {
      expect(wrapper.get(`.header-nav [data-nav-key="${key}"] .material-symbols-outlined`).text()).toBe(icon)
    }
  })

  it('labels only the active desktop route and exposes navigation accessibly', () => {
    const wrapper = mountHeader()
    const views = wrapper.get('[data-nav-key="views"]')
    const recent = wrapper.get('[data-nav-key="recent"]')

    expect(views.get('.nav-link-label').text()).toBe('Views')
    expect(views.attributes('aria-label')).toBe('Views')
    expect(views.attributes('title')).toBe('Views')

    expect(recent.find('.nav-link-label').exists()).toBe(false)
    expect(recent.attributes('aria-label')).toBe('Recent')
  })

  it('marks manually matched child routes as the current page', async () => {
    route.path = '/views/123'
    const wrapper = mountHeader()

    expect(wrapper.get('.nav-link[data-nav-key="views"]').attributes('aria-current')).toBe('page')

    await wrapper.get('.header-actions-mobile .icon-btn').trigger('click')
    expect(wrapper.get('.mobile-nav-link[data-nav-key="views"]').attributes('aria-current')).toBe('page')
  })

  it('keeps icon labels in mobile navigation and exposes language accessibly', async () => {
    const wrapper = mountHeader()
    await wrapper.get('.header-actions-mobile .icon-btn').trigger('click')

    const mobileViews = wrapper.get('.mobile-nav-link[data-nav-key="views"]')
    expect(mobileViews.get('.material-symbols-outlined').text()).toBe('view_list')
    expect(mobileViews.get('.mobile-nav-label').text()).toBe('Views')

    const localeButtons = wrapper.findAll('.locale-toggle')
    expect(localeButtons).toHaveLength(2)
    for (const button of localeButtons) {
      expect(button.get('.material-symbols-outlined').text()).toBe('language')
      expect(button.text()).not.toMatch(/\b(EN|RU)\b/)
      expect(button.attributes('aria-label')).toContain('EN')
    }
  })

  it('keeps only capture and menu actions in the mobile header bar', async () => {
    localStorage.setItem('token', 'token')
    localStorage.setItem('username', 'admin')
    localStorage.setItem('role', 'ADMIN')
    const wrapper = mountHeader()
    const mobileActions = wrapper.get('.header-actions-mobile')

    expect(mobileActions.find('.quick-capture').exists()).toBe(true)
    expect(mobileActions.find('[aria-label="Navigation menu"]').exists()).toBe(true)
    expect(mobileActions.find('[aria-label="Profile"]').exists()).toBe(false)
    expect(mobileActions.find('[aria-label="Admin"]').exists()).toBe(false)
    expect(mobileActions.find('.locale-toggle').exists()).toBe(false)
    expect(mobileActions.find('[aria-label="Logout"]').exists()).toBe(false)

    await mobileActions.get('[aria-label="Navigation menu"]').trigger('click')
    const menu = wrapper.get('.mobile-nav-menu')
    expect(menu.find('[aria-label="Profile"]').exists()).toBe(true)
    expect(menu.find('[aria-label="Admin"]').exists()).toBe(true)
    expect(menu.find('.locale-toggle').exists()).toBe(true)
    expect(menu.find('[aria-label="Logout"]').exists()).toBe(true)
    expect(menu.find('[title="Theme: System"]').exists()).toBe(true)
  })

  it('exposes brand mark with hideable logo text for narrow screens', () => {
    const wrapper = mountHeader()
    const logo = wrapper.get('.logo')

    expect(logo.find('.logo-mark').exists()).toBe(true)
    expect(logo.get('.logo-text').text()).toBe('MDWiki')
    expect(logo.attributes('aria-label')).toBe('MDWiki')
  })
})
