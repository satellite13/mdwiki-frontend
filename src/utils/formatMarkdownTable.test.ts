import { describe, expect, it } from 'vitest'
import { findPipeTableRange, formatPipeTableAtCursor } from './formatMarkdownTable'
import { splitTablePipeCells } from './tablePipeCells'

describe('findPipeTableRange', () => {
  it('returns null when delimiter row column count mismatches header', () => {
    const text = '| a | b |\n| --- |\n'
    const range = findPipeTableRange(text, 2)
    expect(range).toBeNull()
  })

  it('locates a valid pipe table around the cursor', () => {
    const text = 'intro\n\n| h1 | h2 |\n| --- | --- |\n| x | yy |\n\noutro'
    const range = findPipeTableRange(text, text.indexOf('h1'))
    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('| h1 | h2 |\n| --- | --- |\n| x | yy |')
  })
})

describe('formatPipeTableAtCursor', () => {
  it('aligns columns with padded cells and delimiter row', () => {
    const raw = '|a|bb|\n|---|---|\n|c|d|\n'
    const cursor = raw.indexOf('bb')
    const result = formatPipeTableAtCursor(raw, cursor)
    expect(result).not.toBeNull()
    expect(result!.text).toBe('| a   | bb  |\n| --- | --- |\n| c   | d   |\n')
  })

  it('preserves left, right, and center alignment markers in the delimiter row', () => {
    const raw = '|n|x|y|\n|:---|---:|:---:|\n|1|2|3|\n'
    const result = formatPipeTableAtCursor(raw, raw.indexOf('n'))
    expect(result).not.toBeNull()
    expect(result!.text).toBe(
      '| n    |    x |   y   |\n| :--- | ---: | :---: |\n| 1    |    2 |   3   |\n'
    )
  })

  it('gives every pipe-column segment the same length across rows (monospace alignment)', () => {
    const raw =
      '| Год | Событие |\n| --- | --- |\n| 2020 | Lewis |\n| 2022–2023 | Широкое внедрение |\n'
    const out = formatPipeTableAtCursor(raw, raw.indexOf('Год'))!.text
    const lines = out.trimEnd().split('\n')
    const col0Lens = lines.map((ln) => ln.split('|')[1]?.length ?? 0)
    const col1Lens = lines.map((ln) => ln.split('|')[2]?.length ?? 0)
    expect(new Set(col0Lens).size).toBe(1)
    expect(new Set(col1Lens).size).toBe(1)
  })

  it('returns null when the cursor is not inside a pipe table', () => {
    const text = 'just prose\n\nno table\n'
    expect(formatPipeTableAtCursor(text, 3)).toBeNull()
  })

  it('formats tables with wikilink label separators in cells', () => {
    const raw =
      '| Сущность | Описание |\n| --- | --- |\n| [[axenix|AXENIX]] | Консалтинг |\n| [[dam|DAM]] | S3 |\n'
    const result = formatPipeTableAtCursor(raw, raw.indexOf('Сущность'))
    expect(result).not.toBeNull()
    expect(result!.text).toContain('[[axenix|AXENIX]]')
    expect(result!.text).toContain('[[dam|DAM]]')
    const lines = result!.text.trimEnd().split('\n')
    expect(lines).toHaveLength(4)
    expect(lines.every((ln) => splitTablePipeCells(ln).length === 2)).toBe(true)
  })
})
