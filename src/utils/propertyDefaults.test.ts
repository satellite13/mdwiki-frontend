import { describe, expect, it } from 'vitest'
import { hasFrontmatterKey, upsertFrontmatterField } from './frontmatter'
import { defaultPropertyYamlValue } from './propertyDefaults'

describe('upsertFrontmatterField', () => {
  it('creates frontmatter when absent', () => {
    expect(upsertFrontmatterField('# Title\n', 'status', '"draft"')).toBe(
      '---\nstatus: "draft"\n---\n\n# Title\n'
    )
  })

  it('adds a new key after title', () => {
    const src = '---\ntitle: Doc\n---\n\nbody'
    expect(upsertFrontmatterField(src, 'priority', '1')).toBe(
      '---\ntitle: Doc\npriority: 1\n---\n\nbody'
    )
  })

  it('updates an existing key', () => {
    const src = '---\ntest: 10\n---\n\nbody'
    expect(upsertFrontmatterField(src, 'test', '20')).toBe('---\ntest: 20\n---\n\nbody')
  })
})

describe('hasFrontmatterKey', () => {
  it('detects existing keys', () => {
    expect(hasFrontmatterKey('---\ntest: 10\n---\n', 'test')).toBe(true)
    expect(hasFrontmatterKey('---\ntest: 10\n---\n', 'other')).toBe(false)
  })
})

describe('defaultPropertyYamlValue', () => {
  it('returns type-specific placeholders', () => {
    expect(defaultPropertyYamlValue({ type: 'NUMBER', config: {} })).toBe('0')
    expect(defaultPropertyYamlValue({ type: 'BOOLEAN', config: {} })).toBe('false')
    expect(defaultPropertyYamlValue({ type: 'MULTI_SELECT', config: {} })).toBe('[]')
    expect(defaultPropertyYamlValue({ type: 'SELECT', config: { options: ['A', 'B'] } })).toBe('"A"')
    expect(defaultPropertyYamlValue({ type: 'TEXT', config: {} })).toBe('""')
  })
})
