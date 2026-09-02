import { i18n } from '@/i18n'

export function sanitizePdfFilename(title: string): string {
  const base = title.trim() || 'page'
  const cleaned = base
    // eslint-disable-next-line no-control-regex -- намеренно вырезаем управляющие символы из имени файла
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || 'page'
}

function resolvePrintTitle(title: string): string {
  return title.trim() || i18n.global.t('common.untitled')
}

function normalizeHeadingText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function firstContentHeading(root: HTMLElement): HTMLElement | null {
  return root.querySelector('h1, h2, h3, h4, h5, h6')
}

export function createPdfPrintHost(title: string, contentElement: HTMLElement): HTMLDivElement {
  const printTitle = resolvePrintTitle(title)
  const host = document.createElement('div')
  host.className = 'pdf-export-host'
  host.setAttribute('data-pdf-print-host', '')

  const body = contentElement.cloneNode(true) as HTMLElement
  body.removeAttribute('style')
  body.querySelectorAll('.heading-copy-btn, .code-copy-btn').forEach((el) => el.remove())
  body.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager'
    img.removeAttribute('loading')
  })

  const existingHeading = firstContentHeading(body)
  const headingAlreadyPresent =
    existingHeading !== null &&
    normalizeHeadingText(existingHeading.textContent ?? '') === normalizeHeadingText(printTitle)

  if (!headingAlreadyPresent) {
    const titleEl = document.createElement('h1')
    titleEl.className = 'pdf-export-title'
    titleEl.textContent = printTitle
    host.append(titleEl)
  }

  host.append(body)

  const slack = document.createElement('div')
  slack.className = 'pdf-print-slack'
  slack.setAttribute('data-pdf-print-slack', '')
  slack.setAttribute('aria-hidden', 'true')
  host.append(slack)

  return host
}

function isExternalStylesheet(node: Element): boolean {
  if (node.tagName !== 'LINK') return false
  const href = (node as HTMLLinkElement).href || node.getAttribute('href') || ''
  return /^(https?:)?\/\//.test(href) && !href.startsWith(window.location.origin)
}

function copyStylesInto(target: Document): void {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    if (isExternalStylesheet(node)) return
    target.head.appendChild(target.importNode(node, true))
  })
}

const PDF_PRINT_UNLOCK_CSS = `
html.pdf-print-root,
html.pdf-print-root body,
html.pdf-print-root [data-pdf-print-host],
html.pdf-print-root [data-pdf-print-host] * {
  height: auto !important;
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
}
`

function injectPrintUnlock(target: Document): void {
  const style = target.createElement('style')
  style.setAttribute('data-pdf-print-unlock', '')
  style.textContent = PDF_PRINT_UNLOCK_CSS
  target.head.appendChild(style)
}

export function fillPdfPrintDocument(
  target: Document,
  title: string,
  contentElement: HTMLElement
): void {
  const printTitle = resolvePrintTitle(title)
  target.documentElement.classList.add('pdf-print-root')
  target.title = printTitle
  copyStylesInto(target)
  target.body.replaceChildren()
  const host = createPdfPrintHost(title, contentElement)
  target.body.appendChild(target.importNode(host, true))
  injectPrintUnlock(target)
}

export function openPdfPrintWindow(): Window | null {
  return window.open('', '_blank')
}

export async function printPagePdf(options: {
  title: string
  contentElement: HTMLElement
  targetWindow?: Window
  openWindow?: () => Window | null
  print?: (win: Window) => void
}): Promise<void> {
  const opened =
    options.targetWindow ?? (options.openWindow ?? openPdfPrintWindow)()
  if (!opened) {
    throw new Error(i18n.global.t('export.pdfPopupBlocked'))
  }

  fillPdfPrintDocument(opened.document, options.title, options.contentElement)

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      opened.removeEventListener('afterprint', finish)
      if (opened !== window) opened.close()
      resolve()
    }
    const timeoutId = window.setTimeout(finish, 60_000)
    opened.addEventListener('afterprint', finish, { once: true })
    try {
      if (options.print) options.print(opened)
      else opened.print()
    } catch (error) {
      window.clearTimeout(timeoutId)
      opened.removeEventListener('afterprint', finish)
      if (opened !== window) opened.close()
      settled = true
      reject(error)
    }
  })
}
