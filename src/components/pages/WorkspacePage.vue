<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, watch } from 'vue'
import { useWorkspacePage } from '@/composables/useWorkspacePage'
import { useEditorUiStore } from '@/stores/editorUi'
import type { EditorMode } from '@/components/editor/editorPreferences'

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
  onContentChange,
  onTitleInput,
  onEditorSave,
  clearSaveError,
  toggleGraph
} = useWorkspacePage()

const editorUi = useEditorUiStore()

function onEditorModeChange(mode: EditorMode) {
  editorUi.setReadingMode(mode === 'reading')
}

onBeforeUnmount(() => {
  editorUi.setReadingMode(false)
})

watch(page, (nextPage) => {
  if (!nextPage) {
    editorUi.setReadingMode(false)
  }
})
</script>

<template>
  <div class="workspace" :class="{ 'reading-mode': editorUi.isReadingMode }" v-if="page">
    <nav v-if="!editorUi.isReadingMode && page.folderPath && page.folderPath.length" class="breadcrumbs">
      <router-link to="/" class="breadcrumb-item">/</router-link>
      <template v-for="folder in page.folderPath" :key="folder.id">
        <span class="breadcrumb-item">{{ folder.name }}</span>
        <span class="breadcrumb-sep">/</span>
      </template>
      <span class="breadcrumb-current">{{ page.title }}</span>
    </nav>
    <div v-if="loading" class="workspace-loading">Loading...</div>
    <div v-if="!editorUi.isReadingMode" class="workspace-header">
      <input
        class="title-input"
        :value="title"
        @input="onTitleInput"
        placeholder="Page title"
      />
      <span v-if="isDirty()" class="unsaved-dot" title="Unsaved changes"></span>
      <span v-if="saveError" class="save-error" @click="clearSaveError">{{ saveError }}</span>
      <button
        class="graph-toggle"
        @click="toggleGraph"
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
        :readingTitle="title || page.title"
        @update:modelValue="onContentChange"
        @save="onEditorSave"
        @mode-change="onEditorModeChange"
      />
    </div>

    <div v-if="!editorUi.isReadingMode && showGraph && page" class="graph-area">
      <GraphPanel :slug="page.slug" />
    </div>

    <div class="backlinks-panel" v-if="!editorUi.isReadingMode && backlinks.length">
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
