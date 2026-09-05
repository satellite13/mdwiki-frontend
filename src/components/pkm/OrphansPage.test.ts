import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import OrphansPage from './OrphansPage.vue'

const route = reactive({ name: 'orphans', query: { definition: 'NO_INCOMING' } })
const replace = vi.fn()
const getOrphans = vi.fn().mockResolvedValue({ data: [] })
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('@/api/linkInsights', () => ({ getOrphans: (...args: unknown[]) => getOrphans(...args) }))

describe('OrphansPage navigation', () => {
  it('stores selected orphan definition in the URL', async () => {
    const wrapper = mount(OrphansPage, {
      global: { plugins: [i18n], stubs: { DiscoveryNav: true, RouterLink: true } }
    })
    await flushPromises()
    await wrapper.get('[data-testid="app-select-trigger"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option-NO_LINKS"]').trigger('click')
    expect(replace).toHaveBeenCalledWith({ query: { definition: 'NO_LINKS' } })
  })
})
