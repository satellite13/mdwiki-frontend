import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as pagesApi from '@/api/pages'
import type { PageListItem } from '@/types'

export const usePageStore = defineStore('pages', () => {
  const pages = ref<PageListItem[]>([])
  const loading = ref(false)

  async function fetchPages(force = false) {
    if (!force && pages.value.length > 0) return
    loading.value = true
    try { const { data } = await pagesApi.listPages(); pages.value = data }
    finally { loading.value = false }
  }

  return { pages, loading, fetchPages }
})
