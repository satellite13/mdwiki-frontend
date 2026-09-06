import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import DiscoveryNav from './DiscoveryNav.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ name: 'unlinked-mentions' }) }))

describe('DiscoveryNav', () => {
  it('exposes discovery destinations and current state', () => {
    const wrapper = mount(DiscoveryNav, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: { props: ['to'], template: '<a :data-to="to" v-bind="$attrs"><slot /></a>' } }
      }
    })
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('data-to'))).toEqual([
      '/links/unlinked',
      '/links/orphans',
      '/broken-links',
    ])
    expect(links[0].attributes('aria-current')).toBe('page')
  })
})
