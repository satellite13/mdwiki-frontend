import { describe, expect, it } from 'vitest'
import { diffRows } from './diffRows'

describe('diffRows', () => {
  it('preserves unicode and a removed trailing newline', () => {
    expect(diffRows('Привет\nмир\n', 'Привет\nмир!').rows).toEqual([
      { kind: 'context', before: 'Привет', after: 'Привет' },
      { kind: 'remove', before: 'мир', after: null },
      { kind: 'add', before: null, after: 'мир!' },
      { kind: 'remove', before: '', after: null },
    ])
  })

  it('bounds work for large inputs', () => {
    const before = Array.from({ length: 10_001 }, (_, i) => `before-${i}`).join('\n')
    const after = Array.from({ length: 10_001 }, (_, i) => `after-${i}`).join('\n')
    expect(diffRows(before, after).truncated).toBe(true)
  })

  it('keeps huge nearly identical documents fast and DOM-bounded', () => {
    const lines = Array.from({ length: 100_000 }, (_, i) => `line-${i}`)
    const before = lines.join('\n')
    lines[50_000] = 'changed'
    const started = performance.now()
    const result = diffRows(before, lines.join('\n'))

    expect(result.truncated).toBe(true)
    expect(result.rows.length).toBeLessThan(100)
    expect(result.rows.some(row => row.before === 'line-50000')).toBe(true)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('places truncation marker before retained suffix on both sides', () => {
    const suffix = Array.from({ length: 5_001 }, (_, i) => `same-${i}`)
    const result = diffRows(['left-change', ...suffix].join('\n'), ['right-change', ...suffix].join('\n'))

    expect(result.rows.slice(0, 4)).toEqual([
      { kind: 'remove', before: 'left-change', after: null },
      { kind: 'add', before: null, after: 'right-change' },
      { kind: 'context', before: '…', after: '…' },
      { kind: 'context', before: 'same-4981', after: 'same-4981' },
    ])
    expect(result.rows.at(-1)).toEqual({ kind: 'context', before: 'same-5000', after: 'same-5000' })
  })

  it('keeps marker after changed rows when no suffix exists', () => {
    const left = Array.from({ length: 5_001 }, (_, i) => `left-${i}`).join('\n')
    const right = Array.from({ length: 5_001 }, (_, i) => `right-${i}`).join('\n')
    const result = diffRows(left, right)

    expect(result.rows.slice(0, 2)).toEqual([
      { kind: 'remove', before: 'left-0', after: null },
      { kind: 'remove', before: 'left-1', after: null },
    ])
    expect(result.rows.at(-1)).toEqual({ kind: 'context', before: '…', after: '…' })
  })
})
