import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import * as pagesApi from '@/api/pages'
import type { Page } from '@/types'
import { t } from '@/utils/i18n'
import { getApiErrorMessage } from '@/utils/apiError'

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
  const saveStatus = ref<SaveStatus>('idle')
  const saveError = ref<string | null>(null)
  const isSaving = ref(false)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function isDirty() {
    return state.title.value !== state.lastSavedTitle.value || state.content.value !== state.lastSavedContentMd.value
  }

  function clearSaveTimer() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  function resetSaveState() {
    clearSaveTimer()
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

  async function doSave() {
    if (!state.page.value) return
    if (isSaving.value) return
    clearSaveTimer()
    if (!isDirty()) return
    isSaving.value = true
    saveStatus.value = 'saving'
    saveError.value = null
    const prevTitle = state.lastSavedTitle.value
    const prevSlug = state.page.value.slug
    try {
      const { data: updatedPage } = await pagesApi.updatePage(state.page.value.slug, {
        title: state.title.value,
        contentMd: state.content.value,
        clearFolder: false
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
      setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, 2000)
    } catch (e) {
      saveStatus.value = 'idle'
      saveError.value = getApiErrorMessage(e, t.errors.savePageFailed)
      console.error('Failed to save page:', e)
    } finally {
      isSaving.value = false
    }
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
