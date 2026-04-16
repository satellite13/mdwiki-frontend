<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as pagesApi from '@/api/pages'
import type { Page, Backlink } from '@/types'
import MarkdownEditor from '@/components/editor/MarkdownEditor.vue'

const route = useRoute()

const page = ref<Page | null>(null)
const backlinks = ref<Backlink[]>([])
const loading = ref(true)
const title = ref('')
const content = ref('')
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function loadPage(slug: string) {
  loading.value = true
  saveStatus.value = 'idle'
  try {
    const [pageRes, backlinksRes] = await Promise.all([
      pagesApi.getPage(slug),
      pagesApi.getBacklinks(slug)
    ])
    page.value = pageRes.data
    backlinks.value = backlinksRes.data
    title.value = pageRes.data.title
    content.value = pageRes.data.contentMd || ''
  } finally {
    loading.value = false
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, 2000)
}

async function doSave() {
  if (!page.value) return
  saveStatus.value = 'saving'
  try {
    await pagesApi.updatePage(page.value.slug, {
      title: title.value,
      contentMd: content.value
    })
    saveStatus.value = 'saved'
    setTimeout(() => { if (saveStatus.value === 'saved') saveStatus.value = 'idle' }, 2000)
  } catch {
    saveStatus.value = 'idle'
  }
}

function onContentChange(val: string) {
  content.value = val
  scheduleSave()
}

function onTitleInput(e: Event) {
  title.value = (e.target as HTMLInputElement).value
  scheduleSave()
}

function onEditorSave() {
  if (saveTimer) clearTimeout(saveTimer)
  doSave()
}

onMounted(() => {
  const slug = route.params.slug as string
  if (slug) loadPage(slug)
})

watch(() => route.params.slug, (slug) => {
  if (slug) loadPage(slug as string)
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    doSave()
  }
})
</script>

<template>
  <div class="workspace" v-if="!loading && page">
    <div class="workspace-header">
      <input
        class="title-input"
        :value="title"
        @input="onTitleInput"
        placeholder="Page title"
      />
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
  font-size: 24px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--color-text);
  padding: 4px 0;
  outline: none;
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
  color: var(--color-success);
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
