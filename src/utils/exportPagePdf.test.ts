import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizePdfFilename } from './exportPagePdf'

const html2canvasMock = vi.fn()

vi.mock('html2canvas-pro', () => ({
  default: (...args: unknown[]) => html2canvasMock(...args)
}))

vi.mock('jspdf', () => {
  class FakePdf {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    addPage = vi.fn()
    addImage = vi.fn()
    save = vi.fn()
  }
  return { jsPDF: FakePdf }
})

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

describe('downloadPagePdf', () => {
  beforeEach(() => {
    html2canvasMock.mockReset()
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 400
    html2canvasMock.mockResolvedValue(canvas)
  })

  it('uses html2canvas-pro so CSS color() from the browser does not abort export', async () => {
    const { downloadPagePdf } = await import('./exportPagePdf')
    const content = document.createElement('article')
    content.style.color = 'color(srgb 0.14 0.16 0.18)'
    content.textContent = 'hello'
    document.body.appendChild(content)

    await downloadPagePdf({ title: 'Note', contentElement: content })

    expect(html2canvasMock).toHaveBeenCalledTimes(1)
    content.remove()
  })
})
