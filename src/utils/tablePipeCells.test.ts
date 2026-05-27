import { describe, expect, it } from 'vitest'
import { protectWikilinkTablePipes, splitTablePipeCells, WIKILINK_TABLE_PIPE } from './tablePipeCells'

describe('splitTablePipeCells', () => {
  it('splits a simple pipe row', () => {
    expect(splitTablePipeCells('| a | b |')).toEqual([' a ', ' b '])
  })

  it('does not split on pipe inside wikilink label separator', () => {
    expect(splitTablePipeCells('| [[axenix|AXENIX]] | Консалтинг |')).toEqual([
      ' [[axenix|AXENIX]] ',
      ' Консалтинг '
    ])
  })

  it('does not split on pipe inside inline code', () => {
    expect(splitTablePipeCells('| `a|b` | c |')).toEqual([' `a|b` ', ' c '])
  })
})

describe('protectWikilinkTablePipes', () => {
  it('replaces label separator with placeholder', () => {
    expect(protectWikilinkTablePipes('[[axenix|AXENIX]]')).toBe(
      `[[axenix${WIKILINK_TABLE_PIPE}AXENIX]]`
    )
  })

  it('leaves unlabeled wikilinks unchanged', () => {
    expect(protectWikilinkTablePipes('[[page]]')).toBe('[[page]]')
  })
})
