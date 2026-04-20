import { computed, nextTick, ref, type ComputedRef } from 'vue'

const MAX_HISTORY = 300

export interface EditorHistoryApi {
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  isApplying: () => boolean
  reset(value: string): void
  push(value: string): void
  undo(): string | null
  redo(): string | null
}

export function useEditorHistory(initial: string): EditorHistoryApi {
  const stack = ref<string[]>([initial])
  const index = ref(0)
  const applying = ref(false)

  const canUndo = computed(() => index.value > 0)
  const canRedo = computed(() => index.value < stack.value.length - 1)

  function reset(value: string): void {
    stack.value = [value]
    index.value = 0
  }

  function push(value: string): void {
    if (applying.value) return
    if (stack.value[index.value] === value) return
    const next = stack.value.slice(0, index.value + 1)
    next.push(value)
    stack.value = next.slice(-MAX_HISTORY)
    index.value = stack.value.length - 1
  }

  function undo(): string | null {
    if (!canUndo.value) return null
    applying.value = true
    index.value -= 1
    const value = stack.value[index.value]
    nextTick(() => {
      applying.value = false
    })
    return value
  }

  function redo(): string | null {
    if (!canRedo.value) return null
    applying.value = true
    index.value += 1
    const value = stack.value[index.value]
    nextTick(() => {
      applying.value = false
    })
    return value
  }

  return {
    canUndo,
    canRedo,
    isApplying: () => applying.value,
    reset,
    push,
    undo,
    redo
  }
}
