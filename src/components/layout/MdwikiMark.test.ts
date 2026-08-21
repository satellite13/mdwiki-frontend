/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MdwikiMark from './MdwikiMark.vue'

const faviconPath = join(dirname(fileURLToPath(import.meta.url)), '../../../public/favicon.svg')

const bracketPath =
  'M14 8h-3.5A1.5 1.5 0 0 0 9 9.5v13a1.5 1.5 0 0 0 1.5 1.5H14' +
  'M23 8h-3.5A1.5 1.5 0 0 0 18 9.5v13a1.5 1.5 0 0 0 1.5 1.5H23'

describe('MdwikiMark', () => {
  it('renders the approved flat two-color mark', () => {
    const wrapper = mount(MdwikiMark)
    const svg = wrapper.get('svg')
    const rects = wrapper.findAll('rect')
    const paths = wrapper.findAll('path')

    expect(svg.attributes('viewBox')).toBe('0 0 32 32')
    expect(svg.attributes('aria-hidden')).toBe('true')
    expect(svg.attributes('focusable')).toBe('false')
    expect(wrapper.find('defs').exists()).toBe(false)
    expect(wrapper.find('filter').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/\sfilter=/)
    expect(wrapper.html()).not.toContain('currentColor')

    expect(rects).toHaveLength(1)
    expect(paths).toHaveLength(1)

    expect(rects[0]!.attributes()).toMatchObject({
      x: '3',
      y: '3',
      width: '26',
      height: '26',
      rx: '4',
      fill: '#0d9488'
    })
    expect(paths[0]!.attributes()).toMatchObject({
      d: bracketPath,
      fill: 'none',
      stroke: '#fff',
      'stroke-width': '2.6',
      'stroke-linecap': 'square'
    })
  })

  it('keeps favicon geometry aligned with the Vue mark', () => {
    const favicon = readFileSync(faviconPath, 'utf8')

    expect(favicon).not.toMatch(/linearGradient|filter|feDropShadow|currentColor/)

    const doc = new DOMParser().parseFromString(favicon, 'image/svg+xml')
    const svg = doc.documentElement

    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32')

    const rects = doc.querySelectorAll('rect')
    const paths = doc.querySelectorAll('path')

    expect(rects).toHaveLength(1)
    expect(paths).toHaveLength(1)

    const rect = rects[0]!
    expect(rect.getAttribute('x')).toBe('3')
    expect(rect.getAttribute('y')).toBe('3')
    expect(rect.getAttribute('width')).toBe('26')
    expect(rect.getAttribute('height')).toBe('26')
    expect(rect.getAttribute('rx')).toBe('4')
    expect(rect.getAttribute('fill')).toBe('#0d9488')

    const path = paths[0]!
    expect(path.getAttribute('d')).toBe(bracketPath)
    expect(path.getAttribute('fill')).toBe('none')
    expect(path.getAttribute('stroke')).toBe('#fff')
    expect(path.getAttribute('stroke-width')).toBe('2.6')
    expect(path.getAttribute('stroke-linecap')).toBe('square')
  })
})
