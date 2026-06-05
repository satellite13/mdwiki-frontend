import { describe, expect, it } from 'vitest'
import { sanitizePdfFilename } from './exportPagePdf'

describe('sanitizePdfFilename', () => {
  it('returns page for empty title', () => {
    expect(sanitizePdfFilename('')).toBe('page')
    expect(sanitizePdfFilename('   ')).toBe('page')
  })

  it('removes invalid filename characters', () => {
    expect(sanitizePdfFilename('Notes: Q1/Q2')).toBe('Notes Q1Q2')
    expect(sanitizePdfFilename('file|name?.md')).toBe('filename.md')
  })

  it('trims and collapses whitespace', () => {
    expect(sanitizePdfFilename('  My   Page  ')).toBe('My Page')
  })

  it('limits filename length', () => {
    expect(sanitizePdfFilename('a'.repeat(200)).length).toBe(120)
  })
})
