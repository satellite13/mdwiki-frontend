<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as pagesApi from '@/api/pages'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import { normalizePageSlug, titleForStubPage } from '@/utils/pageSlug'
import {
  refreshWikilinkPreviewIndex,
  getWikilinkPreviewPages,
  slugCandidatesForNavigation
} from '@/utils/wikilinkResolve'
import type { Page, Backlink } from '@/types'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'
import GraphPanel from '@/components/graph/GraphPanel.vue'

const route = useRoute()
const router = useRouter()
const folderStore = useFolderStore()
const auth = useAuthStore()

const page = ref<Page | null>(null)
const backlinks = ref<Backlink[]>([])
/** Only true while fetching a page from the API (no slug in URL ⇒ idle, not "loading"). */
const loading = ref(!!route.params.slug)
const title = ref('')
const content = ref('')
const lastSavedTitle = ref('')
const lastSavedContentMd = ref('')
const showGraph = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
const saveError = ref<string | null>(null)
const isSaving = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function isDirty() {
  return title.value !== lastSavedTitle.value || content.value !== lastSavedContentMd.value
}

function clearSaveTimer() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

async function loadPage(slugParam: string) {
  clearSaveTimer()
  loading.value = true
  saveStatus.value = 'idle'
  page.value = null

  await refreshWikilinkPreviewIndex()
  const tryOrder = slugCandidatesForNavigation(slugParam, getWikilinkPreviewPages())
  const normalized = normalizePageSlug(slugParam)

  let loaded: Page | null = null
  let resolvedSlug = slugParam

  for (const s of tryOrder) {
    try {
      const { data } = await pagesApi.getPage(s)
      loaded = data
      resolvedSlug = data.slug
      if (data.slug !== slugParam) {
        router.replace(`/page/${data.slug}`)
      }
      break
    } catch (e) {
      if (!axios.isAxiosError(e) || e.response?.status !== 404) {
        loading.value = false
        return
      }
    }
  }

  if (!loaded && auth.isEditor && normalized) {
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
        router.replace(`/page/${data.slug}`)
      }
      await folderStore.fetchTree(true)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        try {
          const { data } = await pagesApi.getPage(normalized)
          loaded = data
          resolvedSlug = data.slug
          if (slugParam !== data.slug) {
            router.replace(`/page/${data.slug}`)
          }
          await folderStore.fetchTree(true)
        } catch {
          loading.value = false
          return
        }
      } else {
        loading.value = false
        return
      }
    }
  }

  if (!loaded) {
    loading.value = false
    return
  }

  page.value = loaded
  try {
    backlinks.value = (await pagesApi.getBacklinks(resolvedSlug)).data
  } catch {
    backlinks.value = []
  }
  title.value = loaded.title
  lastSavedTitle.value = loaded.title
  const md = loaded.contentMd || ''
  lastSavedContentMd.value = md
  content.value = md
  loading.value = false
}

function scheduleSaveIfDirty() {
  if (!isDirty()) {
    clearSaveTimer()
    return
  }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, 2000)
}

async function doSave() {
  if (!page.value) return
  if (isSaving.value) return
  clearSaveTimer()
  if (!isDirty()) return
  isSaving.value = true
  saveStatus.value = 'saving'
  saveError.value = null
  const prevTitle = lastSavedTitle.value
  const prevSlug = page.value.slug
  try {
    const { data: updatedPage } = await pagesApi.updatePage(page.value.slug, {
      title: title.value,
      contentMd: content.value,
      clearFolder: false
    })
    page.value = updatedPage
    lastSavedTitle.value = updatedPage.title
    lastSavedContentMd.value = updatedPage.contentMd || ''
    if (updatedPage.slug !== prevSlug) {
      await router.replace(`/page/${encodeURIComponent(updatedPage.slug)}`)
    }
    if (updatedPage.title !== prevTitle || updatedPage.slug !== prevSlug) {
      await folderStore.fetchTree(true)
    }
    saveStatus.value = 'saved'
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = 'idle' }, 2000)
  } catch (e) {
    saveStatus.value = 'idle'
    saveError.value = 'Failed to save page. Changes may be lost.'
    console.error('Failed to save page:', e)
  } finally {
    isSaving.value = false
  }
}

function onContentChange(val: string) {
  content.value = val
  scheduleSaveIfDirty()
}

function onTitleInput(e: Event) {
  title.value = (e.target as HTMLInputElement).value
  scheduleSaveIfDirty()
}

function onEditorSave() {
  clearSaveTimer()
  doSave()
}

onMounted(() => {
  const slug = route.params.slug as string
  if (slug) loadPage(slug)
})

watch(() => route.params.slug, (slug) => {
  if (slug) {
    loadPage(slug as string)
    return
  }
  clearSaveTimer()
  loading.value = false
  page.value = null
  backlinks.value = []
  title.value = ''
  content.value = ''
  lastSavedTitle.value = ''
  lastSavedContentMd.value = ''
  saveStatus.value = 'idle'
  saveError.value = null
})

watch(() => isDirty(), (dirty) => {
  const baseTitle = title.value || 'MDWiki'
  document.title = dirty ? `● ${baseTitle} — MDWiki` : `${baseTitle} — MDWiki`
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearSaveTimer()
    void doSave()
  }
})
</script>

<template>
  <div class="workspace" v-if="page">
    <nav v-if="page.folderPath && page.folderPath.length" class="breadcrumbs">
      <router-link to="/" class="breadcrumb-item">Root</router-link>
      <span class="breadcrumb-sep">/</span>
      <template v-for="folder in page.folderPath" :key="folder.id">
        <span class="breadcrumb-item">{{ folder.name }}</span>
        <span class="breadcrumb-sep">/</span>
      </template>
      <span class="breadcrumb-current">{{ page.title }}</span>
    </nav>
    <div v-if="loading" class="workspace-loading">Loading...</div>
    <div class="workspace-header">
      <input
        class="title-input"
        :value="title"
        @input="onTitleInput"
        placeholder="Page title"
      />
      <span v-if="isDirty()" class="unsaved-dot" title="Unsaved changes"></span>
      <span v-if="saveError" class="save-error" @click="saveError = null">{{ saveError }}</span>
      <button
        class="graph-toggle"
        @click="showGraph = !showGraph"
        :title="showGraph ? 'Hide neighborhood graph' : 'Neighborhood graph (this page and linked pages, depth 1–3)'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="showGraph ? 'var(--color-primary)' : 'currentColor'" stroke-width="2">
          <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/>
          <line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="15.5" y1="7.5" x2="8.5" y2="7.5"/>
        </svg>
      </button>
      <span :class="['save-status', saveStatus]">
        <template v-if="saveStatus === 'saving'">Saving...</template>
        <template v-else-if="saveStatus === 'saved'">Saved</template>
      </span>
    </div>

    <div class="editor-area">
      <MarkdownEditor
        :modelValue="content"
        @update:modelValue="onContentChange"
        @save="onEditorSave"
      />
    </div>

    <div v-if="showGraph && page" class="graph-area">
      <GraphPanel :slug="page.slug" />
    </div>

    <div class="backlinks-panel" v-if="backlinks.length">
      <details>
        <summary>Backlinks ({{ backlinks.length }})</summary>
        <ul>
          <li v-for="bl in backlinks" :key="bl.slug">
            <router-link :to="`/page/${bl.slug}`">{{ bl.title }}</router-link>
          </li>
        </ul>
      </details>
    </div>
  </div>
  <div v-else-if="loading" class="state-placeholder">Loading...</div>
  <div v-else class="empty-workspace">
    <p>Select a page from the sidebar or create a new one.</p>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.workspace-loading {
  position: absolute;
  top: 12px;
  right: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  z-index: 2;
}

.workspace-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.title-input {
  flex: 1;
  font-size: 28px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: var(--color-text);
  padding: 4px 0;
  outline: none;
  letter-spacing: -0.3px;
}

.title-input:focus {
  box-shadow: none;
}

.save-status {
  font-size: 12px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.save-status.saved {
  color: var(--color-primary);
}

.unsaved-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-tag);
  display: inline-block;
  flex-shrink: 0;
}

.save-error {
  font-size: 12px;
  color: #e53e3e;
  cursor: pointer;
  flex-shrink: 0;
}

.graph-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.graph-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.graph-area {
  height: 300px;
  margin-top: 12px;
}

.editor-area {
  flex: 1;
  min-height: 0;
}

.backlinks-panel {
  border-top: 1px solid var(--color-border);
  padding: 12px 0;
  margin-top: 12px;
}

.backlinks-panel summary {
  font-size: 13px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-weight: 500;
}

.backlinks-panel ul {
  list-style: none;
  padding: 8px 0 0;
}

.backlinks-panel li {
  padding: 2px 0;
  font-size: 13px;
}

.empty-workspace {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 15px;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-faint);
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.breadcrumb-item {
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
}

.breadcrumb-item:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.breadcrumb-sep {
  color: var(--color-text-faint);
  user-select: none;
}

.breadcrumb-current {
  color: var(--color-text);
  font-weight: 500;
}
</style>
