import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadingToc from './ReadingToc.vue'
import { i18n } from '@/i18n'

const items = [
  { id: 'h1', text: 'Intro', level: 1 },
  { id: 'h2', text: 'Details', level: 2 },
]

function mountToc(variant: 'sidebar' | 'sheet' = 'sidebar') {
  return mount(ReadingToc, {
    props: { items, theme: 'white', variant },
    global: { plugins: [i18n] },
  })
}

describe('ReadingToc', () => {
  it('shows close control only in sheet variant', async () => {
    const sidebar = mountToc('sidebar')
    expect(sidebar.find('.reading-toc-close').exists()).toBe(false)

    const sheet = mountToc('sheet')
    expect(sheet.find('.reading-toc-close').exists()).toBe(true)
    await sheet.get('.reading-toc-close').trigger('click')
    expect(sheet.emitted('close')?.at(-1)).toEqual([])
  })

  it('emits select without closing', async () => {
    const wrapper = mountToc('sheet')
    await wrapper.get('.reading-toc-select').trigger('click')
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['h1'])
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
