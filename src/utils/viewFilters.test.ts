import { describe, expect, it } from 'vitest'
import {
  buildViewFilters,
  coerceFilterValue,
  defaultOperatorForType,
  operatorsForPropertyType,
  selectOptionsFromConfig,
} from './viewFilters'

describe('viewFilters', () => {
  it('returns operators allowed by property type', () => {
    expect(operatorsForPropertyType('TEXT')).toEqual(['EQ', 'NEQ', 'CONTAINS', 'EXISTS'])
    expect(operatorsForPropertyType('MULTI_SELECT')).toEqual(['CONTAINS', 'EXISTS'])
    expect(defaultOperatorForType('MULTI_SELECT')).toBe('CONTAINS')
  })

  it('builds EQ filter with coerced number and omits value for EXISTS', () => {
    expect(buildViewFilters(
      [
        { key: 'priority', op: 'EQ', value: '3' },
        { key: 'status', op: 'EXISTS', value: '' },
      ],
      { priority: 'NUMBER', status: 'SELECT' }
    )).toEqual([
      { key: 'priority', op: 'EQ', value: 3 },
      { key: 'status', op: 'EXISTS' },
    ])
  })

  it('rejects blank value for non-EXISTS filters', () => {
    expect(() => coerceFilterValue('TEXT', 'EQ', '  ')).toThrow('value-required')
  })

  it('reads SELECT options from property config', () => {
    expect(selectOptionsFromConfig({ options: ['todo', 'done'] })).toEqual(['todo', 'done'])
  })
})
