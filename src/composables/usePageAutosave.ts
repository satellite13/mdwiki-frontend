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
      try {
        const { data: updatedPage } = await pagesApi.updatePage(state.page.value.slug, {
          title: state.title.value,
          contentMd: state.content.value,
          clearFolder: false,
          expectedUpdatedAt: state.page.value.updatedAt
        })
        state.page.value = updatedPage
        state.lastSavedTitle.value = updatedPage.title
        state.lastSavedContentMd.value = updatedPage.contentMd || ''
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
    saveChain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async function flushPendingSave() {
    if (!saveTimer) return
    clearSaveTimer()
    await doSave()
  }

  function onContentChange(value: string) {
    state.content.value = value
    scheduleSaveIfDirty()
  }

  function onTitleInput(e: Event) {
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
