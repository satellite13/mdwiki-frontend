<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import * as pagesApi from '@/api/pages'
import { useFolderStore } from '@/stores/folders'
import { useAuthStore } from '@/stores/auth'
import { normalizePageSlug, titleForStubPage } from '@/utils/pageSlug'
import type { Page, Backlink } from '@/types'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'

const route = useRoute()
const router = useRouter()
const folderStore = useFolderStore()
const auth = useAuthStore()

const page = ref<Page | null>(null)
const backlinks = ref<Backlink[]>([])
const loading = ref(true)
const title = ref('')
const content = ref('')
const lastSavedTitle = ref('')
const lastSavedContentMd = ref('')
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

  const normalized = normalizePageSlug(slugParam)
  const tryOrder = [...new Set([slugParam, normalized].filter((s): s is string => !!s))]

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
  try {
    const { data: updatedPage } = await pagesApi.updatePage(page.value.slug, {
      title: title.value,
      contentMd: content.value,
      clearFolder: false
    })
    page.value = updatedPage
    lastSavedTitle.value = updatedPage.title
    lastSavedContentMd.value = updatedPage.contentMd || ''
    if (updatedPage.title !== prevTitle) {
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
  if (slug) loadPage(slug as string)
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
</style>
