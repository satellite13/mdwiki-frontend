export interface CaretCoords {
  left: number
  top: number
  height: number
}

const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'fontFamily', 'lineHeight', 'letterSpacing', 'textTransform', 'textIndent',
  'textDecoration', 'wordSpacing', 'tabSize'
] as const

/**
 * Вычисляет координаты каретки внутри textarea через скрытый mirror-элемент.
 * Координаты возвращаются в системе viewport.
 */
export function caretCoordsInTextarea(el: HTMLTextAreaElement, pos: number): CaretCoords {
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(el)
  MIRROR_PROPS.forEach((prop) => {
    ;(mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(prop)
  })
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.pointerEvents = 'none'
  mirror.textContent = el.value.slice(0, pos)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const left = elRect.left + (markerRect.left - mirrorRect.left) - el.scrollLeft
  const top = elRect.top + (markerRect.top - mirrorRect.top) - el.scrollTop
  const height = markerRect.height || Number.parseFloat(style.lineHeight) || 18
  document.body.removeChild(mirror)
  return { left, top, height }
}
