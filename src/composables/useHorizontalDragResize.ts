import { onBeforeUnmount } from 'vue'

type ResizeDragCallbacks = {
  onMove: (event: MouseEvent) => void
  onStart?: () => void
  onEnd?: () => void
}

export function useHorizontalDragResize() {
  let pointerMoveHandler: ((event: MouseEvent) => void) | null = null
  let pointerUpHandler: (() => void) | null = null

  function clearDragListeners() {
    if (pointerMoveHandler) window.removeEventListener('mousemove', pointerMoveHandler)
    if (pointerUpHandler) window.removeEventListener('mouseup', pointerUpHandler)
    pointerMoveHandler = null
    pointerUpHandler = null
  }

  function startResizeDrag(event: MouseEvent, callbacks: ResizeDragCallbacks) {
    callbacks.onStart?.()
    pointerMoveHandler = (moveEvent: MouseEvent) => {
      callbacks.onMove(moveEvent)
    }
    pointerUpHandler = () => {
      callbacks.onEnd?.()
      clearDragListeners()
    }

    window.addEventListener('mousemove', pointerMoveHandler)
    window.addEventListener('mouseup', pointerUpHandler)
    event.preventDefault()
  }

  onBeforeUnmount(() => {
    clearDragListeners()
  })

  return { startResizeDrag, clearDragListeners }
}
