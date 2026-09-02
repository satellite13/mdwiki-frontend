import { describe, expect, it, vi } from 'vitest'
import { createPdfPrintHost, printPagePdf, sanitizePdfFilename } from './exportPagePdf'

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

describe('createPdfPrintHost', () => {
  it('builds a light print host with title and article text, without editor chrome', () => {
    const source = document.createElement('div')
    source.className = 'preview-content markdown-body'
    source.setAttribute('style', 'font-size: 22px')
    source.innerHTML = '<p>Hello wiki</p><button class="heading-copy-btn">copy</button>'
    document.body.appendChild(source)

    const host = createPdfPrintHost('  Architecture  ', source)

    expect(host.getAttribute('data-pdf-print-host')).toBe('')
    expect(host.classList.contains('pdf-export-host')).toBe(true)
    expect(host.textContent).toContain('Hello wiki')
    expect(host.textContent).toContain('Architecture')
    expect(host.querySelector('.heading-copy-btn')).toBeNull()
    expect(host.querySelector('.preview-content')?.getAttribute('style')).toBeNull()

    source.remove()
  })

  it('does not add a second title when the article already starts with the same heading', () => {
    const source = document.createElement('div')
    source.innerHTML = '<h1>Architecture</h1><p>Body</p>'

    const host = createPdfPrintHost('Architecture', source)
    const headings = Array.from(host.querySelectorAll('h1')).map((el) => el.textContent?.trim())

    expect(headings).toEqual(['Architecture'])
    expect(host.textContent).toContain('Body')
  })

  it('appends trailing slack so print can grow onto an extra page instead of clipping the last paragraph', () => {
    const source = document.createElement('div')
    source.innerHTML = '<p>Body</p>'

    const host = createPdfPrintHost('Note', source)
    const slack = host.querySelector('[data-pdf-print-slack]')

    expect(slack).not.toBeNull()
    expect(host.lastElementChild).toBe(slack)
  })
})

function createPrintTarget(): { win: Window; dispose: () => void } {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-pdf-test-frame', '')
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) throw new Error('test print frame unavailable')
  return {
    win,
    dispose: () => iframe.remove()
  }
}

describe('printPagePdf', () => {
  it('prints a dedicated document window with the full article, not the app window', async () => {
    const source = document.createElement('article')
    source.innerHTML = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index}</p>`).join('')
    document.body.appendChild(source)
    const { win: target, dispose } = createPrintTarget()

    let printedWindow: Window | null = null
    await printPagePdf({
      title: 'Note',
      contentElement: source,
      targetWindow: target,
      print: (win) => {
        printedWindow = win
        const host = win.document.querySelector('[data-pdf-print-host]') as HTMLElement | null
        expect(win === window).toBe(false)
        expect(win).toBe(target)
        expect(win.document.documentElement.classList.contains('pdf-print-root')).toBe(true)
        expect(host).not.toBeNull()
        expect(host?.textContent).toContain('Paragraph 0')
        expect(host?.textContent).toContain('Paragraph 39')
        expect(document.querySelector('[data-pdf-print-host]')).toBeNull()
        win.dispatchEvent(new Event('afterprint'))
      }
    })

    expect(printedWindow === target).toBe(true)
    expect(document.documentElement.classList.contains('pdf-print-root')).toBe(false)
    dispose()
    source.remove()
  })

  it('opens the print window before filling so the click is not lost after preview work', async () => {
    const source = document.createElement('article')
    source.innerHTML = '<p>Hello</p>'
    document.body.appendChild(source)
    const { win: target, dispose } = createPrintTarget()
    const openWindow = vi.fn(() => target)

    await printPagePdf({
      title: 'Note',
      contentElement: source,
      openWindow,
      print: (win) => {
        expect(openWindow).toHaveBeenCalledTimes(1)
        expect(win).toBe(target)
        win.dispatchEvent(new Event('afterprint'))
      }
    })

    dispose()
    source.remove()
  })

  it('prints without waiting for a lazy image that never loads', async () => {
    const source = document.createElement('article')
    const img = document.createElement('img')
    img.setAttribute('loading', 'lazy')
    img.src = 'http://127.0.0.1:9/never-loads.png'
    source.append(document.createTextNode('Visible text'), img)
    document.body.appendChild(source)
    const { win: target, dispose } = createPrintTarget()

    let printed = false
    await printPagePdf({
      title: 'Note',
      contentElement: source,
      targetWindow: target,
      print: (win) => {
        printed = true
        win.dispatchEvent(new Event('afterprint'))
      }
    })

    expect(printed).toBe(true)
    dispose()
    source.remove()
  }, 1500)
})
