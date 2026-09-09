import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MermaidFullscreenOverlay from './MermaidFullscreenOverlay.vue'
import { i18n, setLocale } from '@/i18n'

describe('MermaidFullscreenOverlay', () => {
  it('shows the diagram svg and closes from the toolbar button, overlay click, and Escape', async () => {
    setLocale('en')
    const wrapper = mount(MermaidFullscreenOverlay, {
      props: { svgHtml: '<svg id="wide-chart"></svg>' },
      global: { plugins: [i18n] },
      attachTo: document.body
    })
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Diagram')
    expect(wrapper.html()).toContain('id="wide-chart"')

    await wrapper.get('[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
    const again = mount(MermaidFullscreenOverlay, {
      props: { svgHtml: '<svg id="wide-chart"></svg>' },
      global: { plugins: [i18n] },
      attachTo: document.body
    })
    await again.get('.mermaid-fs-overlay').trigger('click')
    expect(again.emitted('close')).toHaveLength(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(again.emitted('close')?.length).toBeGreaterThanOrEqual(2)
    again.unmount()
  })
})
