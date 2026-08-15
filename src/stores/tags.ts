import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as tagsApi from '@/api/tags'
import type { Tag } from '@/types'

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  const selectedTags = ref<string[]>([])
  const tagsCollapsed = ref(false)

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

  function toggleTagFilter(tagName: string) {
    const name = tagName.trim()
    if (!name) return
    if (selectedTags.value.includes(name)) {
      selectedTags.value = selectedTags.value.filter((tag) => tag !== name)
    } else {
      selectedTags.value = [...selectedTags.value, name]
    }
    tagsCollapsed.value = false
  }

  function clearTagFilter() {
    selectedTags.value = []
  }

  return {
    tags,
    selectedTags,
    tagsCollapsed,
    fetchTags,
    toggleTagFilter,
    clearTagFilter
  }
})
