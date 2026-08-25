import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadPageMarkdown, markdownExportFilename } from './exportPageMarkdown'

describe('markdownExportFilename', () => {
  it('appends .md to a sanitized title', () => {
    expect(markdownExportFilename('Notes: Q1/Q2')).toBe('Notes Q1Q2.md')
  })

  it('does not double the .md suffix', () => {
    expect(markdownExportFilename('note.md')).toBe('note.md')
  })

  it('falls back to page.md for a blank name', () => {
    expect(markdownExportFilename('   ')).toBe('page.md')
  })
})

describe('downloadPageMarkdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads the current markdown under a .md filename', () => {
    const click = vi.fn()
    const revoke = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock-md',
      revokeObjectURL: revoke
    })
    const nativeCreate = document.createElement.bind(document)
    const captured: { anchor?: HTMLAnchorElement } = {}
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const el = nativeCreate(tagName, options)
      if (tagName === 'a') {
        captured.anchor = el as HTMLAnchorElement
        el.click = click
      }
      return el
    })
    const blobSpy = vi.spyOn(globalThis, 'Blob')

    downloadPageMarkdown({ filenameBase: 'warchi-launch-plan', contentMd: '# Hello\n' })

    expect(blobSpy).toHaveBeenCalledWith(['# Hello\n'], { type: 'text/markdown;charset=utf-8' })
    expect(captured.anchor?.download).toBe('warchi-launch-plan.md')
    expect(captured.anchor?.href).toBe('blob:mock-md')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:mock-md')
  })
})
