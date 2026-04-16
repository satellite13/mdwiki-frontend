import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as tagsApi from '@/api/tags'
import type { Tag } from '@/types'

export const useTagStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  async function fetchTags() { const { data } = await tagsApi.listTags(); tags.value = data }
  return { tags, fetchTags }
})
