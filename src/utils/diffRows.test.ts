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
})
