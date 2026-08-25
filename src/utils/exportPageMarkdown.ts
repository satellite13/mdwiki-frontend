import { sanitizePdfFilename } from './exportPagePdf'

export function markdownExportFilename(filenameBase: string): string {
  const base = sanitizePdfFilename(filenameBase)
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`
}

export function downloadPageMarkdown(options: {
  filenameBase: string
  contentMd: string
}): void {
  const filename = markdownExportFilename(options.filenameBase)
  const blob = new Blob([options.contentMd], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
