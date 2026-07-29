import type * as mermaid from 'mermaid'

type PreviewRootGetter = () => HTMLElement | null

type PreviewRenderPipelineOptions = {
  getRoot: PreviewRootGetter
  shouldRender: () => boolean
  isDark: () => boolean
  renderStructurizrSvg: (source: string, isDark: boolean) => string
}

export function usePreviewRenderPipeline(options: PreviewRenderPipelineOptions) {
  let mermaidLoader: Promise<typeof mermaid> | null = null

  async function loadMermaid() {
    if (!mermaidLoader) {
      mermaidLoader = import('mermaid')
    }
    const module = await mermaidLoader
    return module.default
  }

  function normalizeTableColumnAlignment() {
    const root = options.getRoot()
    if (!root) return
    const tables = root.querySelectorAll<HTMLTableElement>('table')
    tables.forEach((table) => {
      const headerCells = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'))
      if (!headerCells.length) return
      const columnAlignments = headerCells.map((th) => (th.style.textAlign || th.getAttribute('align') || '').trim())
      if (!columnAlignments.some(Boolean)) return
      const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr')
      rows.forEach((row) => {
        const cells = Array.from(row.children) as HTMLElement[]
        columnAlignments.forEach((align, idx) => {
          if (!align) return
          const cell = cells[idx]
          if (!cell) return
          cell.style.textAlign = align
        })
      })
    })
  }

  async function renderMermaid() {
    if (!options.shouldRender()) return
    const root = options.getRoot()
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'))
    if (!nodes.length) return

    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      theme: options.isDark() ? 'dark' : 'default',
      securityLevel: 'strict'
    })
    for (const node of nodes) {
      const source = node.dataset.source || node.textContent || ''
      if (!node.dataset.source) node.dataset.source = source
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
      try {
        const { svg } = await mermaid.render(id, source)
        node.innerHTML = svg
      } catch {
        // keep source code when render fails
      }
    }
  }

  function renderStructurizr() {
    if (!options.shouldRender()) return
    const root = options.getRoot()
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.structurizr'))
    for (const node of nodes) {
      const source = node.dataset.source || node.textContent || ''
      if (!node.dataset.source) node.dataset.source = source
      try {
        node.innerHTML = options.renderStructurizrSvg(source, options.isDark())
      } catch {
        // keep source code when render fails
      }
    }
  }

  async function renderPreviewBase() {
    await renderMermaid()
    renderStructurizr()
    normalizeTableColumnAlignment()
  }

  return {
    renderPreviewBase
  }
}
