import { describe, expect, it } from 'vitest'
import { createPdfPrintHost, fillPdfPrintDocument, printPagePdf, sanitizePdfFilename } from './exportPagePdf'

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
})

describe('fillPdfPrintDocument', () => {
  it('does not copy external font stylesheets into the print document', () => {
    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans'
    document.head.appendChild(fontLink)

    const source = document.createElement('article')
    source.textContent = 'Hello'
    const doc = document.implementation.createHTMLDocument('')
    fillPdfPrintDocument(doc, 'Note', source)

    const hrefs = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(
      (node) => (node as HTMLLinkElement).href
    )
    expect(hrefs.some((href) => href.includes('fonts.googleapis.com'))).toBe(false)

    fontLink.remove()
  })

  it('injects an always-on overflow unlock so app CSS cannot clip the article to one page', () => {
    const clip = document.createElement('style')
    clip.textContent = 'html, body { height: 100%; overflow: hidden; }'
    document.head.appendChild(clip)

    const source = document.createElement('article')
    source.innerHTML = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index}</p>`).join('')
    const doc = document.implementation.createHTMLDocument('')
    fillPdfPrintDocument(doc, 'Note', source)

    const unlock = doc.head.querySelector('[data-pdf-print-unlock]')
    expect(unlock?.textContent).toMatch(/overflow:\s*visible\s*!important/)
    expect(doc.body.textContent).toContain('Paragraph 39')
    const unlockCss = unlock?.textContent ?? ''
    expect(unlockCss.indexOf('@media')).toBe(-1)

    clip.remove()
  })
})

describe('printPagePdf', () => {
  it('prints an iframe document sized to the full article, not the main window', async () => {
    const source = document.createElement('article')
    source.innerHTML = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index}</p>`).join('')
    document.body.appendChild(source)

    let printedWindow: Window | null = null
    await printPagePdf({
      title: 'Note',
      contentElement: source,
      print: (win) => {
        printedWindow = win
        const frame = document.querySelector('iframe.pdf-print-frame') as HTMLIFrameElement | null
        expect(win).not.toBe(window)
        expect(win.document.title).toBe('Note')
        expect(win.document.body.textContent).toContain('Paragraph 0')
        expect(win.document.body.textContent).toContain('Paragraph 39')
        expect(frame).not.toBeNull()
        const contentHeight = Math.max(
          win.document.documentElement.scrollHeight,
          win.document.body.scrollHeight
        )
        expect(parseInt(frame!.style.height, 10)).toBeGreaterThanOrEqual(contentHeight)
        win.dispatchEvent(new Event('afterprint'))
      }
    })

    expect(printedWindow).not.toBeNull()
    expect(printedWindow).not.toBe(window)
    expect(document.querySelector('iframe.pdf-print-frame')).toBeNull()
    source.remove()
  })

  it('prints without waiting for a lazy image that never loads', async () => {
    const source = document.createElement('article')
    const img = document.createElement('img')
    img.setAttribute('loading', 'lazy')
    img.src = 'http://127.0.0.1:9/never-loads.png'
    source.append(document.createTextNode('Visible text'), img)
    document.body.appendChild(source)

    let printed = false
    await printPagePdf({
      title: 'Note',
      contentElement: source,
      print: (win) => {
        printed = true
        win.dispatchEvent(new Event('afterprint'))
      }
    })

    expect(printed).toBe(true)
    source.remove()
  }, 1500)
})
