import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTagStore } from '@/stores/tags'
import { getPages } from '@/services/pageIndex'
import type { FolderTreeNode } from '@/types'

export function usePageTags() {
  const tagStore = useTagStore()
  const { selectedTags, tagsCollapsed } = storeToRefs(tagStore)

  const tagsLoading = ref(false)
  const pageTagsBySlug = ref<Record<string, string[]>>({})
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
    tagStore.toggleTagFilter(tagName)
  }

  function clearTagFilter() {
    tagStore.clearTagFilter()
  }

  function toggleTagsPanel() {
    tagsCollapsed.value = !tagsCollapsed.value
  }

  async function refreshPageTagsIndex() {
    // Используем общий кэш pageIndex вместо отдельного цикла пагинации:
    // список страниц с тегами уже загружается там со схлопыванием запросов.
    const pages = await getPages()
    pageTagsBySlug.value = Object.fromEntries(pages.map((page) => [page.slug, page.tags]))
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
