import { computed, ref } from 'vue'
import { useTagStore } from '@/stores/tags'
import * as pagesApi from '@/api/pages'
import type { FolderTreeNode } from '@/types'

export function usePageTags() {
  const tagStore = useTagStore()

  const tagsLoading = ref(false)
  const selectedTags = ref<string[]>([])
  const pageTagsBySlug = ref<Record<string, string[]>>({})
  const tagsCollapsed = ref(false)
  const tagQuery = ref('')

  const filteredTags = computed(() => {
    const query = tagQuery.value.trim().toLowerCase()
    if (!query) return tagStore.tags
    return tagStore.tags.filter((tag) => tag.name.toLowerCase().includes(query))
  })

  function filterTreeByTags(nodes: FolderTreeNode[], tags: string[]): FolderTreeNode[] {
    return nodes.reduce<FolderTreeNode[]>((acc, node) => {
      if (node.type === 'page') {
        const tagNames = node.slug ? pageTagsBySlug.value[node.slug] || [] : []
        if (tags.every((tag) => tagNames.includes(tag))) acc.push(node)
        return acc
      }
      const children = filterTreeByTags(node.children, tags)
      if (children.length > 0) acc.push({ ...node, children })
      return acc
    }, [])
  }

  function toggleTagFilter(tagName: string) {
    if (selectedTags.value.includes(tagName)) {
      selectedTags.value = selectedTags.value.filter((tag) => tag !== tagName)
      return
    }
    selectedTags.value = [...selectedTags.value, tagName]
  }

  function clearTagFilter() {
    selectedTags.value = []
  }

  function toggleTagsPanel() {
    tagsCollapsed.value = !tagsCollapsed.value
  }

  async function refreshPageTagsIndex() {
    const { data } = await pagesApi.listPages()
    pageTagsBySlug.value = Object.fromEntries(data.map((page) => [page.slug, page.tags]))
  }

  async function refreshTagData(force = false) {
    tagsLoading.value = true
    try {
      await Promise.all([tagStore.fetchTags(force), refreshPageTagsIndex()])
    } catch (error) {
      console.error('Failed to refresh tags', error)
    } finally {
      tagsLoading.value = false
    }
    const existingTagNames = new Set(tagStore.tags.map((tag) => tag.name))
    selectedTags.value = selectedTags.value.filter((tagName) => existingTagNames.has(tagName))
  }

  return {
    tagStore,
    tagsLoading,
    selectedTags,
    tagsCollapsed,
    tagQuery,
    filteredTags,
    filterTreeByTags,
    toggleTagFilter,
    clearTagFilter,
    toggleTagsPanel,
    refreshTagData
  }
}
