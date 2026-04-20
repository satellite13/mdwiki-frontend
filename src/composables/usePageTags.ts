import { computed, ref } from 'vue'
import { useTagStore } from '@/stores/tags'
import * as pagesApi from '@/api/pages'
import type { FolderTreeNode } from '@/types'

export function usePageTags() {
  const tagStore = useTagStore()

  const tagsLoading = ref(false)
  const selectedTag = ref<string | null>(null)
  const pageTagsBySlug = ref<Record<string, string[]>>({})
  const tagsCollapsed = ref(false)
  const tagQuery = ref('')

  const filteredTags = computed(() => {
    const query = tagQuery.value.trim().toLowerCase()
    if (!query) return tagStore.tags
    return tagStore.tags.filter((tag) => tag.name.toLowerCase().includes(query))
  })

  function filterTreeByTag(nodes: FolderTreeNode[], tag: string): FolderTreeNode[] {
    return nodes.reduce<FolderTreeNode[]>((acc, node) => {
      if (node.type === 'page') {
        const tagNames = node.slug ? pageTagsBySlug.value[node.slug] || [] : []
        if (tagNames.includes(tag)) acc.push(node)
        return acc
      }
      const children = filterTreeByTag(node.children, tag)
      if (children.length > 0) acc.push({ ...node, children })
      return acc
    }, [])
  }

  function toggleTagFilter(tagName: string) {
    selectedTag.value = selectedTag.value === tagName ? null : tagName
  }

  function clearTagFilter() {
    selectedTag.value = null
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
    if (selectedTag.value && !tagStore.tags.some((tag) => tag.name === selectedTag.value)) {
      selectedTag.value = null
    }
  }

  return {
    tagStore,
    tagsLoading,
    selectedTag,
    tagsCollapsed,
    tagQuery,
    filteredTags,
    filterTreeByTag,
    toggleTagFilter,
    clearTagFilter,
    toggleTagsPanel,
    refreshTagData
  }
}
