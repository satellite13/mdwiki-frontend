import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as tagsApi from '@/api/tags'
import type { Tag } from '@/types'

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  async function fetchTags(force = false) {
    if (!force && tags.value.length > 0) return
    try {
      const { data } = await tagsApi.listTags()
      tags.value = data
    } catch (e) {
      console.error('Failed to fetch tags:', e)
      throw e
    }
  }
  return { tags, fetchTags }
})
