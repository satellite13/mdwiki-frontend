import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFolderStore } from '@/stores/folders'
import type { Backlink, Page } from '@/types'
import { usePageLoader } from '@/composables/usePageLoader'
import { usePageAutosave } from '@/composables/usePageAutosave'

export function useWorkspacePage() {
  const route = useRoute()
  const router = useRouter()
  const folderStore = useFolderStore()

  const page = ref<Page | null>(null)
  const backlinks = ref<Backlink[]>([])
  /** Only true while fetching a page from the API (no slug in URL => idle, not "loading"). */
  const loading = ref(!!route.params.slug)
  const title = ref('')
  const content = ref('')
  const lastSavedTitle = ref('')
  const lastSavedContentMd = ref('')
  const showGraph = ref(false)
  const autosave = usePageAutosave(
    { page, title, content, lastSavedTitle, lastSavedContentMd },
    {
      router,
      fetchTree: () => folderStore.fetchTree(true)
    }
  )
  const { loadPage } = usePageLoader(
    { page, backlinks, loading, title, content, lastSavedTitle, lastSavedContentMd },
    {
      router,
      stopPendingSave: autosave.clearSaveTimer,
      onLoadStart: autosave.resetSaveState
    }
  )

  function resetWorkspaceState() {
    autosave.clearSaveTimer()
    loading.value = false
    page.value = null
    backlinks.value = []
    title.value = ''
    content.value = ''
    lastSavedTitle.value = ''
    lastSavedContentMd.value = ''
    autosave.resetSaveState()
  }

  function clearSaveError() {
    autosave.clearSaveError()
  }

  function toggleGraph() {
    showGraph.value = !showGraph.value
  }

  onMounted(() => {
    const slug = route.params.slug as string
    if (slug) {
      void loadPage(slug)
    }
  })

  watch(() => route.params.slug, (slug) => {
    if (slug) {
      void loadPage(slug as string)
      return
    }
    resetWorkspaceState()
  })

  watch(() => autosave.isDirty(), (dirty) => {
    const baseTitle = title.value || 'MDWiki'
    document.title = dirty ? `● ${baseTitle} — MDWiki` : `${baseTitle} — MDWiki`
  })

  onBeforeUnmount(() => {
    void autosave.flushPendingSave()
  })

  return {
    page,
    backlinks,
    loading,
    title,
    content,
    showGraph,
    saveStatus: autosave.saveStatus,
    saveError: autosave.saveError,
    loadPage,
    isDirty: autosave.isDirty,
    onContentChange: autosave.onContentChange,
    onTitleInput: autosave.onTitleInput,
    onEditorSave: autosave.onEditorSave,
    clearSaveError,
    toggleGraph
  }
}
