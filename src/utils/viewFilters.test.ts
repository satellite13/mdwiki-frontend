import { describe, expect, it } from 'vitest'
import {
  buildViewFilters,
  coerceFilterValue,
  createEmptyViewFilterDraft,
  defaultOperatorForType,
  draftsFromSavedFilters,
  formatViewFilterSummary,
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

  it('creates independent empty drafts', () => {
    const first = createEmptyViewFilterDraft()
    const second = createEmptyViewFilterDraft()
    first.key = 'status'
    expect(second).toEqual({ key: '', op: 'EQ', value: '' })
  })

  it('formats zero, one and multiple filters using the selected localized connector', () => {
    const labels = {
      noFilter: 'No filter',
      allConnector: 'AND',
      anyConnector: 'OR',
      property: (key: string) => ({ status: 'Status', priority: 'Priority' })[key] ?? key,
      operator: (op: string) => ({ EQ: '=', EXISTS: 'exists' })[op] ?? op,
    }
    expect(formatViewFilterSummary([], 'ALL', labels)).toBe('No filter')
    expect(formatViewFilterSummary(
      [{ key: 'status', op: 'EXISTS' }],
      'ALL',
      labels,
    )).toBe('Status · exists')
    const filters = [
      { key: 'status', op: 'EQ' as const, value: 'todo' },
      { key: 'priority', op: 'EQ' as const, value: 3 },
    ]
    expect(formatViewFilterSummary(filters, 'ALL', labels)).toBe('Status = todo AND Priority = 3')
    expect(formatViewFilterSummary(filters, 'ANY', labels)).toBe('Status = todo OR Priority = 3')
  })

  it('restores only editable filters and keeps one empty row when none are valid', () => {
    expect(draftsFromSavedFilters(
      [
        { key: 'status', op: 'EQ', value: 'done' },
        { key: 'deleted', op: 'EQ', value: 'hidden' },
      ],
      { status: 'SELECT' },
    )).toEqual([{ key: 'status', op: 'EQ', value: 'done' }])
    expect(draftsFromSavedFilters(
      [{ key: 'deleted', op: 'EQ', value: 'hidden' }],
      { status: 'SELECT' },
    )).toEqual([{ key: '', op: 'EQ', value: '' }])
  })
})
