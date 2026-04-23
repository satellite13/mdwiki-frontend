type Side = 'editor' | 'preview'
type ElementGetter = () => HTMLElement | null

type SplitScrollSyncOptions = {
  getEditor: ElementGetter
  getPreview: ElementGetter
}

export function useSplitScrollSync(options: SplitScrollSyncOptions) {
  let suppressEditorScrollUntil = 0
  let suppressPreviewScrollUntil = 0

  function getSyncedScrollTop(source: HTMLElement, target: HTMLElement): number | null {
    const sourceMax = source.scrollHeight - source.clientHeight
    const targetMax = target.scrollHeight - target.clientHeight
    if (sourceMax <= 0 || targetMax <= 0) return null
    const ratio = source.scrollTop / sourceMax
    return ratio * targetMax
  }

  function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  function isSuppressed(side: Side) {
    const t = nowMs()
    return side === 'editor' ? t < suppressEditorScrollUntil : t < suppressPreviewScrollUntil
  }

  function suppressSide(side: Side, ms = 140) {
    const until = nowMs() + ms
    if (side === 'editor') {
      suppressEditorScrollUntil = Math.max(suppressEditorScrollUntil, until)
    } else {
      suppressPreviewScrollUntil = Math.max(suppressPreviewScrollUntil, until)
    }
  }

  function setScrollTopSilently(target: HTMLElement, nextTop: number, side: Side) {
    const current = target.scrollTop
    // Ignore tiny deltas to avoid endless micro-adjustment drift.
    if (Math.abs(current - nextTop) < 1.5) return
    suppressSide(side)
    target.scrollTop = nextTop
    requestAnimationFrame(() => suppressSide(side, 80))
  }

  function syncEditorToPreview() {
    if (isSuppressed('editor')) return
    const editor = options.getEditor()
    const preview = options.getPreview()
    if (!editor || !preview) return
    const nextTop = getSyncedScrollTop(editor, preview)
    if (nextTop !== null) setScrollTopSilently(preview, nextTop, 'preview')
  }

  function syncPreviewToEditor() {
    if (isSuppressed('preview')) return
    const editor = options.getEditor()
    const preview = options.getPreview()
    if (!editor || !preview) return
    const nextTop = getSyncedScrollTop(preview, editor)
    if (nextTop !== null) setScrollTopSilently(editor, nextTop, 'editor')
  }

  return {
    syncEditorToPreview,
    syncPreviewToEditor
  }
}
