import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadingBottomSheet from './ReadingBottomSheet.vue'

describe('ReadingBottomSheet', () => {
  it('renders slot when open and exposes aria-label', () => {
    const wrapper = mount(ReadingBottomSheet, {
      props: { open: true, ariaLabel: 'Table of contents' },
      slots: { default: '<div class="sheet-body">Hello</div>' },
    })
    const root = wrapper.get('[data-testid="reading-bottom-sheet"]')
    expect(root.attributes('aria-label')).toBe('Table of contents')
    expect(wrapper.get('.sheet-body').text()).toBe('Hello')
  })

  it('does not render when closed', () => {
    const wrapper = mount(ReadingBottomSheet, {
      props: { open: false, ariaLabel: 'Table of contents' },
      slots: { default: '<div class="sheet-body">Hello</div>' },
    })
    expect(wrapper.find('[data-testid="reading-bottom-sheet"]').exists()).toBe(false)
  })
})
