import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const PDF_PAGE_WIDTH_PX = 794
const PDF_HOST_PADDING = '40px 48px'
const PDF_MARGIN_MM = 10

export function sanitizePdfFilename(title: string): string {
  const base = title.trim() || 'page'
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || 'page'
}

export function createPdfExportHost(title: string, contentElement: HTMLElement): HTMLDivElement {
  const host = document.createElement('div')
  host.className = 'pdf-export-host'
  host.setAttribute('aria-hidden', 'true')

  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${PDF_PAGE_WIDTH_PX}px`,
    background: '#ffffff',
    color: '#24292f',
    padding: PDF_HOST_PADDING,
    boxSizing: 'border-box',
    zIndex: '-1'
  })

  const titleEl = document.createElement('h1')
  titleEl.className = 'pdf-export-title'
  titleEl.textContent = title.trim() || 'Untitled'
  Object.assign(titleEl.style, {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 24px',
    color: '#24292f',
    lineHeight: '1.2'
  })

  const body = contentElement.cloneNode(true) as HTMLElement
  body.querySelectorAll('.heading-copy-btn, .code-copy-btn').forEach((el) => el.remove())
  Object.assign(body.style, {
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: '#24292f'
  })

  host.appendChild(titleEl)
  host.appendChild(body)
  document.body.appendChild(host)
  return host
}

export async function downloadPagePdf(options: {
  title: string
  contentElement: HTMLElement
}): Promise<void> {
  const host = createPdfExportHost(options.title, options.contentElement)
  try {
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: host.scrollWidth,
      height: host.scrollHeight,
      windowWidth: host.scrollWidth,
      windowHeight: host.scrollHeight
    })

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const printableHeight = pageHeight - PDF_MARGIN_MM * 2
    const printableWidth = pageWidth - PDF_MARGIN_MM * 2
    const imgWidth = printableWidth
    const imgHeight = (canvas.height * printableWidth) / canvas.width
    const imgData = canvas.toDataURL('image/png')

    let offsetY = 0
    let pageIndex = 0

    while (offsetY < imgHeight) {
      if (pageIndex > 0) pdf.addPage()
      pdf.addImage(
        imgData,
        'PNG',
        PDF_MARGIN_MM,
        PDF_MARGIN_MM - offsetY,
        imgWidth,
        imgHeight
      )
      offsetY += printableHeight
      pageIndex += 1
    }

    pdf.save(`${sanitizePdfFilename(options.title)}.pdf`)
  } finally {
    host.remove()
  }
}
