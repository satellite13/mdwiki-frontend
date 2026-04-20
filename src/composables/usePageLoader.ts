import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import * as pagesApi from '@/api/pages'
import {
  refreshWikilinkPreviewIndex,
  getWikilinkPreviewPages,
  slugCandidatesForNavigation
} from '@/utils/wikilinkResolve'
import { isApiErrorWithStatus } from '@/utils/apiError'
import type { Backlink, Page } from '@/types'

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
}

/**
 * Загружает страницу с fallback-логикой по slug-кандидатам.
 */
export function usePageLoader(
  state: LoaderState,
  deps: LoaderDependencies
) {
  async function loadPage(slugParam: string) {
    deps.stopPendingSave()
    state.loading.value = true
    deps.onLoadStart?.()
    state.page.value = null

    await refreshWikilinkPreviewIndex()
    const tryOrder = slugCandidatesForNavigation(slugParam, getWikilinkPreviewPages())

    let loaded: Page | null = null
    let resolvedSlug = slugParam

    for (const candidateSlug of tryOrder) {
      try {
        const { data } = await pagesApi.getPage(candidateSlug)
        loaded = data
        resolvedSlug = data.slug
        if (data.slug !== slugParam) {
          await deps.router.replace(`/page/${data.slug}`)
        }
        break
      } catch (e) {
        if (!isApiErrorWithStatus(e, 404)) {
          state.loading.value = false
          return
        }
      }
    }

    if (!loaded) {
      state.loading.value = false
      return
    }

    state.page.value = loaded
    try {
      state.backlinks.value = (await pagesApi.getBacklinks(resolvedSlug)).data
    } catch {
      state.backlinks.value = []
    }
    state.title.value = loaded.title
    state.lastSavedTitle.value = loaded.title
    const md = loaded.contentMd || ''
    state.lastSavedContentMd.value = md
    state.content.value = md
    state.loading.value = false
  }

  return { loadPage }
}
