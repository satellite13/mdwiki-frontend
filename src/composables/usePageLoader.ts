import type { Ref } from 'vue'
import axios from 'axios'
import type { Router } from 'vue-router'
import * as pagesApi from '@/api/pages'
import { normalizePageSlug, titleForStubPage } from '@/utils/pageSlug'
import {
  refreshWikilinkPreviewIndex,
  getWikilinkPreviewPages,
  slugCandidatesForNavigation
} from '@/utils/wikilinkResolve'
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
  isEditor: () => boolean
  fetchTree: () => Promise<void>
  stopPendingSave: () => void
  onLoadStart?: () => void
}

/**
 * Загружает страницу с fallback-логикой по slug-кандидатам и
 * при необходимости создаёт stub-страницу для редактора.
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
    const normalized = normalizePageSlug(slugParam)

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
        if (!axios.isAxiosError(e) || e.response?.status !== 404) {
          state.loading.value = false
          return
        }
      }
    }

    if (!loaded && deps.isEditor() && normalized) {
      try {
        const { data } = await pagesApi.createPage(
          normalized,
          titleForStubPage(slugParam, normalized),
          '',
          undefined
        )
        loaded = data
        resolvedSlug = data.slug
        if (slugParam !== data.slug) {
          await deps.router.replace(`/page/${data.slug}`)
        }
        await deps.fetchTree()
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 409) {
          try {
            const { data } = await pagesApi.getPage(normalized)
            loaded = data
            resolvedSlug = data.slug
            if (slugParam !== data.slug) {
              await deps.router.replace(`/page/${data.slug}`)
            }
            await deps.fetchTree()
          } catch {
            state.loading.value = false
            return
          }
        } else {
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
