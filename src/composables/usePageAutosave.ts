import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import * as pagesApi from '@/api/pages'
import type { Page } from '@/types'
import { useI18n } from 'vue-i18n'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'

type SaveStatus = 'idle' | 'saving' | 'saved'

type AutosaveState = {
  page: Ref<Page | null>
  title: Ref<string>
  content: Ref<string>
  lastSavedTitle: Ref<string>
  lastSavedContentMd: Ref<string>
}

type AutosaveDependencies = {
  router: Router
  fetchTree: () => Promise<void>
}

export function usePageAutosave(
  state: AutosaveState,
  deps: AutosaveDependencies
) {
  const { t } = useI18n()
  const saveStatus = ref<SaveStatus>('idle')
  const saveError = ref<string | null>(null)
  const isSaving = ref(false)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let statusResetTimer: ReturnType<typeof setTimeout> | null = null
  let saveChain: Promise<unknown> = Promise.resolve()
  let pendingSave: Promise<boolean> | null = null
  let pendingFlush: Promise<boolean> | null = null
  let titleGeneration = 0
  let contentGeneration = 0

  function isDirty() {
    return state.title.value !== state.lastSavedTitle.value || state.content.value !== state.lastSavedContentMd.value
  }

  function clearSaveTimer() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  function clearStatusResetTimer() {
    if (statusResetTimer) {
      clearTimeout(statusResetTimer)
      statusResetTimer = null
    }
  }

  function resetSaveState() {
    clearSaveTimer()
    clearStatusResetTimer()
    saveStatus.value = 'idle'
    saveError.value = null
  }

  function scheduleSaveIfDirty() {
    if (!isDirty()) {
      clearSaveTimer()
      return
    }
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void doSave()
    }, 2000)
  }

  async function doSave(): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      if (!state.page.value) return false
      clearSaveTimer()
      if (!isDirty()) return true
      isSaving.value = true
      saveStatus.value = 'saving'
      saveError.value = null
      const prevTitle = state.lastSavedTitle.value
      const prevSlug = state.page.value.slug
      const titleSnapshot = state.title.value
      const contentSnapshot = state.content.value
      const titleSnapshotGeneration = titleGeneration
      const contentSnapshotGeneration = contentGeneration
      try {
        const { data: updatedPage } = await pagesApi.updatePage(state.page.value.slug, {
          title: titleSnapshot,
          contentMd: contentSnapshot,
          clearFolder: false,
          expectedUpdatedAt: state.page.value.updatedAt
        })
        state.page.value = updatedPage
        state.lastSavedTitle.value = updatedPage.title
        state.lastSavedContentMd.value = updatedPage.contentMd || ''
        if (titleGeneration === titleSnapshotGeneration && state.title.value === titleSnapshot) {
          state.title.value = updatedPage.title
        }
        if (contentGeneration === contentSnapshotGeneration && state.content.value === contentSnapshot) {
          state.content.value = updatedPage.contentMd || ''
        }
        if (updatedPage.slug !== prevSlug) {
          await deps.router.replace(`/page/${encodeURIComponent(updatedPage.slug)}`)
        }
        if (updatedPage.title !== prevTitle || updatedPage.slug !== prevSlug) {
          await deps.fetchTree()
        }
        saveStatus.value = 'saved'
        clearStatusResetTimer()
        statusResetTimer = setTimeout(() => {
          if (saveStatus.value === 'saved') saveStatus.value = 'idle'
          statusResetTimer = null
        }, 2000)
        return true
      } catch (e) {
        saveStatus.value = 'idle'
        saveError.value = isApiErrorWithStatus(e, 409)
          ? t('errors.pageChangedElsewhere')
          : getApiErrorMessage(e, t('errors.savePageFailed'))
        console.error('Failed to save page:', e)
        return false
      } finally {
        isSaving.value = false
      }
    }

    const result = saveChain.then(run, run)
    pendingSave = result
    saveChain = result.then(
      () => undefined,
      () => undefined
    )
    void result.finally(() => {
      if (pendingSave === result) pendingSave = null
    })
    return result
  }

  function flushPendingSave(): Promise<boolean> {
    if (pendingFlush) return pendingFlush
    const drain = async (): Promise<boolean> => {
      const attemptedDirtyStates = new Set<string>()
      while (true) {
        clearSaveTimer()
        const currentSave = pendingSave
        if (currentSave) {
          if (!await currentSave) return false
          continue
        }
        if (!isDirty()) return true
        const dirtyState = JSON.stringify([
          titleGeneration,
          contentGeneration,
          state.title.value,
          state.content.value,
          state.lastSavedTitle.value,
          state.lastSavedContentMd.value,
          state.page.value?.updatedAt
        ])
        if (attemptedDirtyStates.has(dirtyState)) return false
        attemptedDirtyStates.add(dirtyState)
        if (!await doSave()) return false
      }
    }
    const result = drain()
    pendingFlush = result
    void result.finally(() => {
      if (pendingFlush === result) pendingFlush = null
    })
    return result
  }

  function onContentChange(value: string) {
    contentGeneration++
    state.content.value = value
    scheduleSaveIfDirty()
  }

  function onTitleInput(e: Event) {
    titleGeneration++
    state.title.value = (e.target as HTMLInputElement).value
    scheduleSaveIfDirty()
  }

  function onEditorSave() {
    clearSaveTimer()
    void doSave()
  }

  function clearSaveError() {
    saveError.value = null
  }

  onBeforeUnmount(() => {
    clearSaveTimer()
    clearStatusResetTimer()
  })

  return {
    saveStatus,
    saveError,
    isDirty,
    clearSaveTimer,
    resetSaveState,
    scheduleSaveIfDirty,
    doSave,
    flushPendingSave,
    onContentChange,
    onTitleInput,
    onEditorSave,
    clearSaveError
  }
}
