import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useFolderStore } from '@/stores/folders'
import { useMovePage } from '@/composables/useMovePage'
import { dndLog, dndLogDragOverThrottled } from '@/utils/dndDebug'
import { parseDndPayload, serializeDndPayload, type TreeDndPayload } from '@/utils/dndPayload'

export interface TreeDropTargetOptions {
  /** Папка-назначение дропа (null = корень дерева). */
  targetFolderId: string | null
  /** Метка зоны в dndLog ('root' / 'folder'). */
  zoneLabel: string
  /** Ключ throttled-лога dragover (например `folder:<id>` / 'root:document-tree'). */
  dragOverLogKey: string
  /** stopPropagation на drop: у папок — да (drop не должен всплывать к родителю), у корня — нет. */
  stopOnDrop: boolean
  /** Доп. поля для dndLog (folderId, folderName, depth, ...). */
  logContext?: () => Record<string, unknown>
}

/** Скаффолдинг drop-зоны дерева: подсветка, сброс по treeDragGeneration, разбор payload и move-вызовы. */
export function useTreeDropTarget(options: TreeDropTargetOptions) {
  const auth = useAuthStore()
  const folderStore = useFolderStore()
  const { movePage } = useMovePage()
  const isDragOver = ref(false)

  watch(
    () => folderStore.treeDragGeneration,
    () => {
      isDragOver.value = false
    }
  )

  function onDragOver(e: DragEvent) {
    if (!auth.isEditor) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    isDragOver.value = true
    const target = e.target as HTMLElement | null
    dndLogDragOverThrottled(options.dragOverLogKey, {
      eventTarget: target?.className ?? target?.tagName,
      ...options.logContext?.()
    })
  }

  function onDragLeave(e: DragEvent) {
    if (!auth.isEditor) return
    const cur = e.currentTarget as HTMLElement
    const rel = e.relatedTarget as Node | null
    if (rel && cur.contains(rel)) return
    // WebKit: relatedTarget часто null при движении внутри той же зоны — не сбрасываем (см. notifyTreeDragEnd).
    if (rel === null) return
    dndLog(`${options.zoneLabel} dragleave (left zone)`, {
      relatedTag: 'tagName' in rel ? (rel as HTMLElement).tagName : null,
      ...options.logContext?.()
    })
    isDragOver.value = false
  }

  async function onDrop(e: DragEvent) {
    if (!auth.isEditor) return
    e.preventDefault()
    if (options.stopOnDrop) e.stopPropagation()
    isDragOver.value = false
    const raw = e.dataTransfer?.getData('text/plain') ?? ''
    dndLog(`${options.zoneLabel} drop (raw)`, {
      rawLength: raw.length,
      raw: raw.slice(0, 200),
      types: e.dataTransfer ? [...e.dataTransfer.types] : [],
      ...options.logContext?.()
    })
    const data = parseDndPayload(raw)
    dndLog(`${options.zoneLabel} drop (parsed)`, { data, ...options.logContext?.() })
    if (!data) return
    const targetFolderId = options.targetFolderId
    try {
      if (data.type === 'page') {
        dndLog(`${options.zoneLabel} drop → movePage`, { slug: data.slug, toFolderId: targetFolderId })
        await movePage(data.slug, targetFolderId)
      } else if (data.type === 'folder' && data.id !== targetFolderId) {
        if (targetFolderId && folderStore.isFolderDescendant(data.id, targetFolderId)) {
          dndLog(`${options.zoneLabel} drop (skip descendant move)`, {
            folderId: data.id,
            attemptedParentId: targetFolderId
          })
          return
        }
        dndLog(`${options.zoneLabel} drop → moveFolder`, { folderId: data.id, toParentId: targetFolderId })
        await folderStore.moveFolder(data.id, targetFolderId)
      }
    } catch (err) {
      dndLog(`${options.zoneLabel} drop (api error)`, { message: err instanceof Error ? err.message : String(err) })
    }
  }

  return { isDragOver, onDragOver, onDragLeave, onDrop }
}

export interface TreeDragSourceOptions {
  /** Payload для dataTransfer; null — dragstart отменяется (например, у страницы нет slug). */
  payload: () => TreeDndPayload | null
  /** Метка зоны в dndLog ('page' / 'folder'). */
  zoneLabel: string
  /** Ключ throttled-лога dragover (для onDragOverAllow); по умолчанию zoneLabel. */
  dragOverLogKey?: string
  /** Доп. поля для dndLog. */
  logContext?: () => Record<string, unknown>
}

/** Скаффолдинг drag-источника дерева: serialize payload, allow-drop dragover, сброс по dragend. */
export function useTreeDragSource(options: TreeDragSourceOptions) {
  const auth = useAuthStore()
  const folderStore = useFolderStore()

  function onDragStart(e: DragEvent) {
    if (!auth.isEditor) return
    const payload = options.payload()
    if (!payload) return
    e.dataTransfer!.setData('text/plain', serializeDndPayload(payload))
    e.dataTransfer!.effectAllowed = 'move'
    dndLog(`${options.zoneLabel} dragstart`, {
      ...payload,
      types: e.dataTransfer ? [...e.dataTransfer.types] : [],
      ...options.logContext?.()
    })
  }

  /** dragover без подсветки: просто разрешает drop (событие всплывёт к ближайшей drop-зоне). */
  function onDragOverAllow(e: DragEvent) {
    if (!auth.isEditor) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dndLogDragOverThrottled(options.dragOverLogKey ?? options.zoneLabel, { ...options.logContext?.() })
  }

  function onDragEnd(e: DragEvent) {
    dndLog(`${options.zoneLabel} dragend`, {
      dropEffect: e.dataTransfer?.dropEffect ?? null,
      ...options.logContext?.()
    })
    folderStore.notifyTreeDragEnd()
  }

  return { onDragStart, onDragOverAllow, onDragEnd }
}
