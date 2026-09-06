import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import * as pagesApi from '@/api/pages'
import { getPages, slugCandidatesForNavigation } from '@/services/pageIndex'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import { normalizePageSlug, titleForStubPage } from '@/utils/pageSlug'
import type { Backlink, Page } from '@/types'
import { touchRecent } from '@/api/library'

type LoaderState = {
  page: Ref<Page | null>
  backlinks: Ref<Backlink[]>
  loading: Ref<boolean>
  title: Ref<string>
  content: Ref<string>
  lastSavedTitle: Ref<string>
  lastSavedContentMd: Ref<string>
}

type LoaderDependencies = {
  router: Router
  stopPendingSave: () => void
  onLoadStart?: () => void
  canCreate?: boolean
}

/**
 * Загружает страницу с fallback-логикой по slug-кандидатам.
 */
export function usePageLoader(
  state: LoaderState,
  deps: LoaderDependencies
) {
  const { t } = useI18n()
  const dialog = useDialogStore()
  let loadGeneration = 0

  function decodeRouteSlug(slugParam: string): string {
    try {
      return decodeURIComponent(slugParam)
    } catch {
      return slugParam
    }
  }

  async function failWithMessage(e: unknown, generation: number) {
    if (generation !== loadGeneration) return
    state.loading.value = false
    await dialog.alert(getApiErrorMessage(e, t('errors.loadPageFailed')))
  }

  async function loadPage(slugParam: string) {
    const generation = ++loadGeneration
    const current = () => generation === loadGeneration
    deps.stopPendingSave()
    state.loading.value = true
    deps.onLoadStart?.()
    state.page.value = null

    const pages = await getPages()
    if (!current()) return
    const tryOrder = slugCandidatesForNavigation(slugParam, pages)

    let loaded: Page | null = null
    let resolvedSlug = slugParam

    for (const candidateSlug of tryOrder) {
      try {
        const { data } = await pagesApi.getPage(candidateSlug)
        if (!current()) return
        loaded = data
        resolvedSlug = data.slug
        if (data.slug !== slugParam) {
          await deps.router.replace(`/page/${data.slug}`)
          if (!current()) return
        }
        break
      } catch (e) {
        if (!isApiErrorWithStatus(e, 404)) {
          await failWithMessage(e, generation)
          return
        }
      }
    }

    if (!loaded) {
      if (deps.canCreate === false) {
        if (current()) state.loading.value = false
        return
      }
      const routeSlug = decodeRouteSlug(slugParam).trim()
      const normalizedSlug = normalizePageSlug(routeSlug)

      if (!normalizedSlug) {
        state.loading.value = false
        return
      }

      const title = titleForStubPage(routeSlug, normalizedSlug)

      try {
        const { data } = await pagesApi.createPage(normalizedSlug, title, '')
        if (!current()) return
        loaded = data
        resolvedSlug = data.slug
        if (data.slug !== slugParam) {
          await deps.router.replace(`/page/${data.slug}`)
          if (!current()) return
        }
      } catch (e) {
        if (!isApiErrorWithStatus(e, 409)) {
          await failWithMessage(e, generation)
          return
        }
        try {
          const { data } = await pagesApi.getPage(normalizedSlug)
          if (!current()) return
          loaded = data
          resolvedSlug = data.slug
          if (data.slug !== slugParam) {
            await deps.router.replace(`/page/${data.slug}`)
            if (!current()) return
          }
        } catch (retryError) {
          await failWithMessage(retryError, generation)
          return
        }
      }
    }

    if (!current()) return
    state.page.value = loaded
    try {
      const backlinks = (await pagesApi.getBacklinks(resolvedSlug)).data
      if (!current()) return
      state.backlinks.value = backlinks
    } catch {
      if (current()) state.backlinks.value = []
    }
    if (!current()) return
    state.title.value = loaded.title
    state.lastSavedTitle.value = loaded.title
    const md = loaded.contentMd || ''
    state.lastSavedContentMd.value = md
    state.content.value = md
    state.loading.value = false
    // Best-effort activity signal: page rendering and navigation never depend on it.
    void touchRecent(loaded.id).catch(() => undefined)
  }

  return { loadPage }
}
