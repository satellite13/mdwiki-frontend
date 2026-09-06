<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspacePage } from '@/composables/useWorkspacePage'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useEditorUiStore } from '@/stores/editorUi'
import { useAuthStore } from '@/stores/auth'
import { useFolderStore } from '@/stores/folders'
import { useDialogStore } from '@/stores/dialog'
import * as pagesApi from '@/api/pages'
import type { PageSectionMapResponse } from '@/types'
import type { EditorMode } from '@/components/editor/editorPreferences'
import { useI18n } from 'vue-i18n'
import { setFrontmatterField, isFrontmatterLocked } from '@/utils/frontmatter'
import { downloadPageMarkdown } from '@/utils/exportPageMarkdown'
import { normalizePageSlug } from '@/utils/pageSlug'
import { getApiErrorMessage } from '@/utils/apiError'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import AppModal from '@/components/ui/AppModal.vue'
import * as libraryApi from '@/api/library'
import { copyTextToClipboard } from '@/utils/clipboard'
import PagePropertiesPanel from './PagePropertiesPanel.vue'

type MarkdownEditorHandle = {
  exportToPdf: () => Promise<void>
  exportingPdf: boolean
}

const { t } = useI18n()
const MarkdownEditor = defineAsyncComponent(() => import('@/components/editor/MarkdownEditor.vue'))
const GraphPanel = defineAsyncComponent(() => import('@/components/graph/GraphPanel.vue'))

const {
  page,
  backlinks,
  loading,
  title,
  content,
  showGraph,
  saveStatus,
  saveError,
  isDirty,
  onContentChange: updateContent,
  onTitleInput,
  onEditorSave: saveFromEditor,
  doSave,
  flushPendingSave,
  clearSaveError,
  toggleGraph,
  acceptExternalPageUpdate
} = useWorkspacePage()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const folderStore = useFolderStore()
const dialog = useDialogStore()
const editorUi = useEditorUiStore()
const { isMobile } = useBreakpoint()
const editorRef = ref<MarkdownEditorHandle | null>(null)
const exportingPdf = ref(false)
const lockBusy = ref(false)
const favorite = ref(false)
const favoriteBusy = ref(false)
const sectionMap = ref<PageSectionMapResponse | null>(null)
const renameOpen = ref(false)
const renameValue = ref('')
const renameBusy = ref(false)
const renameError = ref('')
const routeSectionKey = computed(() =>
  typeof route.query.section === 'string' ? route.query.section : undefined
)
let sectionMapRequestId = 0
let favoriteRequestId = 0

async function exportPdf() {
  if (!editorRef.value?.exportToPdf || exportingPdf.value) return
  exportingPdf.value = true
  try {
    await editorRef.value.exportToPdf()
  } finally {
    exportingPdf.value = false
  }
}

function exportMarkdown() {
  if (!page.value) return
  downloadPageMarkdown({
    filenameBase: page.value.slug || title.value,
    contentMd: content.value
  })
}

function onEditorModeChange(mode: EditorMode) {
  editorUi.setReadingMode(mode === 'reading')
}

function onPropertiesUpdated(updated: typeof page.value) {
  if (!updated) return
  acceptExternalPageUpdate(updated)
}

onBeforeUnmount(() => {
  editorUi.setReadingMode(false)
})

watch(page, (nextPage) => {
  const favoriteId = ++favoriteRequestId
  favoriteBusy.value = false
  const requestId = ++sectionMapRequestId
  sectionMap.value = null
  if (!nextPage) {
    editorUi.setReadingMode(false)
    return
  }
  favorite.value = false
  void libraryApi.getFavorites()
    .then(({ data }) => {
      if (favoriteId === favoriteRequestId && page.value?.id === nextPage.id) {
        favorite.value = data.some((item) => item.page.id === nextPage.id)
      }
    })
    .catch(() => undefined)
  const pageVersion = `${nextPage.slug}:${nextPage.updatedAt}`
  void pagesApi.getPageSections(nextPage.slug)
    .then(({ data }) => {
      const current = page.value
      if (
        requestId === sectionMapRequestId &&
        current &&
        `${current.slug}:${current.updatedAt}` === pageVersion
      ) {
        sectionMap.value = data
      }
    })
    .catch(() => {
      if (requestId === sectionMapRequestId) sectionMap.value = null
    })
}, { immediate: true })

async function toggleFavorite() {
  if (!page.value || favoriteBusy.value) return
  const pageId = page.value.id
  const requestId = favoriteRequestId
  const previous = favorite.value
  favorite.value = !previous
  favoriteBusy.value = true
  try {
    if (favorite.value) await libraryApi.addFavorite(pageId)
    else await libraryApi.removeFavorite(pageId)
  } catch (error) {
    if (requestId === favoriteRequestId && page.value?.id === pageId) {
      favorite.value = previous
      await dialog.alert(getApiErrorMessage(error, t('pkm.favoriteFailed')))
    }
  } finally {
    if (requestId === favoriteRequestId && page.value?.id === pageId) favoriteBusy.value = false
  }
}

const isLocked = computed(() => {
  if (isFrontmatterLocked(content.value)) return true
  return page.value?.locked ?? false
})

async function toggleLock() {
  if (!auth.isEditor || !page.value || lockBusy.value) return
  const prevContent = content.value
  const currentlyLocked = isLocked.value
  const newLocked = !currentlyLocked
  const newContent = setFrontmatterField(prevContent, 'locked', newLocked)
  if (newContent === prevContent) return

  lockBusy.value = true
  content.value = newContent
  try {
    const ok = await doSave()
    if (!ok) {
      content.value = prevContent
    }
  } finally {
    lockBusy.value = false
  }
}

function onContentChange(value: string) {
  if (auth.isEditor && !isLocked.value) updateContent(value)
}

function onEditorSave() {
  if (auth.isEditor && !isLocked.value) saveFromEditor()
}

function openRename() {
  if (!auth.isEditor || isLocked.value || !page.value) return
  renameValue.value = page.value.slug
  renameError.value = ''
  renameOpen.value = true
}

async function renameSlug() {
  if (!page.value || renameBusy.value) return
  const nextSlug = normalizePageSlug(renameValue.value)
  if (!nextSlug) {
    renameError.value = t('workspace.slugRequired')
    return
  }
  renameBusy.value = true
  renameError.value = ''
  try {
    const saved = await flushPendingSave()
    if (!saved || !page.value) return
    const currentSlug = page.value.slug
    const { data } = await pagesApi.updatePage(currentSlug, {
      slug: nextSlug,
      expectedUpdatedAt: page.value.updatedAt
    })
    page.value = data
    renameOpen.value = false
    await router.replace(`/page/${encodeURIComponent(data.slug)}`)
    await folderStore.fetchTree(true)
  } catch (error) {
    renameError.value = getApiErrorMessage(error, t('workspace.renameSlugFailed'))
    await dialog.alert(renameError.value)
  } finally {
    renameBusy.value = false
  }
}

async function copySectionLink(sectionKey: string, stableId?: string): Promise<boolean> {
  if (!page.value) return false
  try {
    let linkPath = `/page/${encodeURIComponent(page.value.slug)}?section=${encodeURIComponent(stableId || sectionKey)}`
    if (auth.isEditor && !stableId) {
      const saved = await flushPendingSave()
      if (!saved || !page.value) return false
      const { data } = await pagesApi.materializeStableLink(
        page.value.slug,
        sectionKey,
        page.value.updatedAt
      )
      linkPath = data.url
      if (data.page) {
        page.value = data.page
        title.value = data.page.title
        content.value = data.page.contentMd ?? ''
      } else {
        const refreshed = await pagesApi.getPage(data.pageSlug)
        page.value = refreshed.data
        title.value = refreshed.data.title
        content.value = refreshed.data.contentMd ?? ''
      }
    }
    return copyTextToClipboard(new URL(linkPath, window.location.origin).toString())
  } catch (error) {
    await dialog.alert(getApiErrorMessage(error, t('editor.copyFailed')))
    return false
  }
}
</script>

<template>
  <div class="workspace" :class="{ 'reading-mode': editorUi.isReadingMode }" v-if="page">
    <div v-if="loading" class="workspace-loading"><SkeletonLoader width="80px" height="12px" /></div>
    <div v-if="!editorUi.isReadingMode" class="workspace-header">
      <input
        v-if="auth.isEditor"
        class="title-input"
        :class="{ 'title-input-locked': isLocked }"
        :value="title"
        @input="onTitleInput"
        :placeholder="t('workspace.pageTitle')"
        :disabled="isLocked"
      />
      <div class="header-actions">
        <router-link
          class="history-btn"
          :to="`/page/${encodeURIComponent(page.slug)}/history`"
          :title="t('history.open')"
          :aria-label="t('history.open')"
        ><span class="material-symbols-outlined notranslate" translate="no">history</span></router-link>
        <button type="button" class="favorite-btn" :class="{ active: favorite }"
          :aria-label="favorite ? t('pkm.removeFavorite') : t('pkm.addFavorite')"
          :aria-pressed="favorite" :aria-busy="favoriteBusy" :disabled="favoriteBusy"
          @click="toggleFavorite">
          <span class="material-symbols-outlined notranslate" translate="no">{{ favorite ? 'star' : 'star_outline' }}</span>
        </button>
        <div v-if="auth.isEditor" class="save-slot" aria-live="polite">
          <span v-if="isDirty()" class="unsaved-dot" :title="t('workspace.unsavedChanges')"></span>
          <span v-if="saveError" class="save-error" @click="clearSaveError">{{ saveError }}</span>
          <span v-else :class="['save-status', saveStatus]">
            <template v-if="saveStatus === 'saving'">{{ t('common.saving') }}</template>
            <template v-else-if="saveStatus === 'saved'">{{ t('workspace.saved') }}</template>
          </span>
        </div>
        <button
          v-if="auth.isEditor"
          type="button"
          class="lock-btn"
          :class="{ locked: isLocked }"
          :disabled="lockBusy"
          :title="isLocked ? t('workspace.unlockPage') : t('workspace.lockPageReadonly')"
          :aria-label="isLocked ? t('workspace.unlockPage') : t('workspace.lockPage')"
          @click="toggleLock"
        >
          <span class="material-symbols-outlined notranslate" translate="no">{{ isLocked ? 'lock' : 'lock_open' }}</span>
        </button>
        <button
          v-if="auth.isEditor && !isLocked"
          type="button"
          class="slug-rename-btn"
          :title="t('workspace.renameSlug')"
          :aria-label="t('workspace.renameSlug')"
          @click="openRename"
        >
          <span class="material-symbols-outlined notranslate" translate="no">drive_file_rename_outline</span>
        </button>
        <button
          type="button"
          class="md-export-btn"
          :title="t('export.mdButton')"
          :aria-label="t('export.mdButton')"
          @click="exportMarkdown"
        >
          <span class="material-symbols-outlined notranslate" translate="no">markdown</span>
        </button>
        <button
          type="button"
          class="pdf-export-btn"
          :disabled="exportingPdf"
          :title="t('export.pdfButton')"
          :aria-label="t('export.pdfButton')"
          @click="exportPdf"
        >
          <span class="material-symbols-outlined notranslate" translate="no">picture_as_pdf</span>
        </button>
        <button
          class="graph-toggle"
          @click="toggleGraph"
          :title="showGraph ? t('workspace.graphHide') : t('workspace.graphShow')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="showGraph ? 'var(--color-primary)' : 'currentColor'" stroke-width="2">
            <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="18" cy="6" r="3"/>
            <line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="15.5" y1="7.5" x2="8.5" y2="7.5"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="editor-area">
      <PagePropertiesPanel
        v-if="!editorUi.isReadingMode"
        :page="page"
        :editable="auth.isEditor && !isLocked"
        :flush-pending-save="flushPendingSave"
        @updated="onPropertiesUpdated"
      />
      <div class="editor-host">
        <MarkdownEditor
          ref="editorRef"
          :modelValue="content"
          :page-slug="page.slug"
          :readingTitle="title || page.title"
          :readonly="!auth.isEditor || isLocked"
          :section-map="sectionMap"
          :section-key="routeSectionKey"
          :copy-section-link="copySectionLink"
          @update:modelValue="onContentChange"
          @save="onEditorSave"
          @mode-change="onEditorModeChange"
          @export-markdown="exportMarkdown"
        />
      </div>
    </div>
    <AppModal
      v-if="renameOpen"
      :label="t('workspace.renameSlug')"
      :close-disabled="renameBusy"
      @close="renameOpen = false"
    >
      <form class="slug-rename-form" @submit.prevent="renameSlug">
        <h2>{{ t('workspace.renameSlug') }}</h2>
        <p>{{ t('workspace.currentSlug', { slug: page.slug }) }}</p>
        <input
          v-model="renameValue"
          class="slug-rename-input"
          :aria-label="t('workspace.newSlug')"
          autocomplete="off"
        />
        <p v-if="renameError" class="save-error" role="alert">{{ renameError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" :disabled="renameBusy" @click="renameOpen = false">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn-primary" :disabled="renameBusy">
            {{ renameBusy ? t('common.saving') : t('common.confirm') }}
          </button>
        </div>
      </form>
    </AppModal>

    <div v-if="!editorUi.isReadingMode && showGraph && page" class="graph-area">
      <GraphPanel :slug="page.slug" />
    </div>

    <div class="backlinks-panel" v-if="!editorUi.isReadingMode && backlinks.length">
      <details>
        <summary>{{ t('workspace.backlinks', { count: backlinks.length }) }}</summary>
        <ul>
          <li v-for="bl in backlinks" :key="bl.slug">
            <router-link :to="`/page/${bl.slug}`">{{ bl.title }}</router-link>
          </li>
        </ul>
      </details>
    </div>
  </div>
  <div v-else-if="loading" class="state-placeholder"><SkeletonPage variant="editor" /></div>
  <div v-else class="empty-workspace">
    <p>{{ t('workspace.emptyHint') }}</p>
    <button
      v-if="isMobile"
      type="button"
      class="btn-secondary open-sidebar-btn"
      @click="editorUi.openMobileSidebar()"
    >
      {{ t('common.openDocuments') }}
    </button>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.save-slot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 8.5rem;
  min-height: 32px;
  margin-right: 4px;
}

.title-input {
  flex: 1;
  min-width: 0;
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

.title-input-locked {
  opacity: 0.6;
  cursor: default;
}

.lock-btn {
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

.favorite-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--color-border);border-radius:6px;background:transparent;color:var(--color-text-muted);cursor:pointer}
.favorite-btn.active{color:var(--color-primary);border-color:var(--color-primary)}
.favorite-btn:disabled{opacity:.6}

.lock-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.lock-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.lock-btn.locked {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.lock-btn.locked:hover {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.lock-btn .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.save-status {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
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

@media (prefers-reduced-motion: no-preference) {
  .save-status.saved {
    animation: fadeIn 0.3s ease both, fadeOut 0.3s ease 1.5s forwards;
  }

  .unsaved-dot {
    animation: pulse 1.8s ease-in-out infinite;
  }
}

.save-error {
  font-size: 12px;
  color: #e53e3e;
  cursor: pointer;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slug-rename-btn,
.history-btn,
.md-export-btn,
.pdf-export-btn,
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

.slug-rename-btn:hover,
.history-btn:hover,
.md-export-btn:hover,
.pdf-export-btn:hover:not(:disabled),
.graph-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.pdf-export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.slug-rename-btn .material-symbols-outlined,
.md-export-btn .material-symbols-outlined,
.pdf-export-btn .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}

.graph-area {
  height: 300px;
  margin-top: 12px;
}

.editor-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-host {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.editor-host :deep(.markdown-editor-wrapper) {
  flex: 1;
  min-height: 0;
  height: auto;
}

.workspace.reading-mode .editor-area {
  height: 100%;
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

.slug-rename-form {
  display: grid;
  gap: 12px;
}

.slug-rename-form h2,
.slug-rename-form p {
  margin: 0;
}

.empty-workspace {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 15px;
  text-align: center;
  padding: 0 16px;
}

.open-sidebar-btn {
  min-height: 40px;
}

@media (max-width: 767px) {
  .workspace-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }

  .title-input {
    flex: 1 1 100%;
    font-size: 22px;
    min-width: 0;
  }

  .header-actions {
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }

  .save-slot {
    order: 1;
    flex: 1 1 100%;
    min-width: 0;
    min-height: 1.25rem;
    margin-right: 0;
    justify-content: flex-start;
  }

  .graph-area {
    height: 220px;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .title-input {
    font-size: 24px;
  }

  .graph-area {
    height: 260px;
  }
}
</style>
