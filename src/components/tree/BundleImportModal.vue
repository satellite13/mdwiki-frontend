<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import SelectableDocumentTree from '@/components/tree/SelectableDocumentTree.vue'
import * as bundlesApi from '@/api/bundles'
import { useDialogStore } from '@/stores/dialog'
import { useFolderStore } from '@/stores/folders'
import { getApiErrorMessage } from '@/utils/apiError'
import { invalidatePageIndex } from '@/services/pageIndex'
import type { BundleImportResponse, FolderTreeNode } from '@/types'

const props = defineProps<{
  tree: FolderTreeNode[]
  file: File
  initialFolderId?: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const dialog = useDialogStore()
const folderStore = useFolderStore()
const targetId = ref<string | null>(props.initialFolderId ?? null)
const loading = ref(false)
const result = ref<BundleImportResponse | null>(null)
const uploadPercent = ref<number | null>(null)
const phase = ref<'idle' | 'upload' | 'processing'>('idle')

function foldersOnlyTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes
    .filter((node) => node.type === 'folder')
    .map((node) => ({ ...node, children: foldersOnlyTree(node.children) }))
}

const foldersOnly = computed(() => foldersOnlyTree(props.tree))

const progressLabel = computed(() => {
  if (phase.value === 'processing') return t('bundle.importProcessing')
  if (phase.value === 'upload') return t('bundle.importUploading')
  return t('bundle.importing')
})

const progressDeterminate = computed(
  () => phase.value === 'upload' && uploadPercent.value !== null
)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function submit() {
  loading.value = true
  phase.value = 'upload'
  uploadPercent.value = null
  try {
    const { data } = await bundlesApi.importBundle(props.file, targetId.value, (percent) => {
      if (percent === null) {
        uploadPercent.value = null
        return
      }
      uploadPercent.value = percent
      if (percent >= 100) phase.value = 'processing'
    })
    result.value = data
    invalidatePageIndex()
    await folderStore.fetchTree(true)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('bundle.importFailed')))
  } finally {
    loading.value = false
    phase.value = 'idle'
    uploadPercent.value = null
  }
}

function finish() {
  emit('close')
}
</script>

<template>
  <AppModal :label="t('bundle.importTitle')" wide :close-disabled="loading" @close="emit('close')">
    <h2>{{ t('bundle.importTitle') }}</h2>
    <p class="hint">{{ t('bundle.importHint', { name: file.name }) }}</p>

    <template v-if="!result">
      <p class="field-label">{{ t('bundle.targetFolder') }}</p>
      <div :class="{ busy: loading }">
        <button
          type="button"
          class="root-btn"
          :class="{ active: targetId === null }"
          :disabled="loading"
          @click="targetId = null"
        >
          {{ t('bundle.wikiRoot') }}
        </button>
        <div class="tree-wrap">
          <SelectableDocumentTree
            mode="single"
            :nodes="foldersOnly"
            :selected="new Set()"
            :active-id="targetId"
            @select="targetId = $event"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="progress"
        role="status"
        aria-live="polite"
        :aria-busy="true"
      >
        <p class="progress-label">{{ progressLabel }}</p>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="progressDeterminate ? uploadPercent ?? undefined : undefined"
          :aria-label="progressLabel"
        >
          <div
            class="progress-bar"
            :class="{ indeterminate: !progressDeterminate }"
            :style="progressDeterminate ? { width: `${uploadPercent}%` } : undefined"
          />
        </div>
        <p class="progress-meta">{{ file.name }} · {{ formatBytes(file.size) }}</p>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" :disabled="loading" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn-primary" :disabled="loading" @click="submit">
          {{ loading ? t('bundle.importing') : t('bundle.importAction') }}
        </button>
      </div>
    </template>

    <template v-else>
      <p class="preview">
        {{
          t('bundle.importSummary', {
            pages: result.createdPages,
            folders: result.createdFolders,
            attachments: result.attachments
          })
        }}
      </p>
      <ul v-if="result.remappedSlugs.length" class="remap">
        <li v-for="item in result.remappedSlugs" :key="item.from">
          {{ item.from }} → {{ item.to }}
        </li>
      </ul>
      <ul v-if="result.errors.length" class="warnings">
        <li v-for="error in result.errors" :key="error">{{ error }}</li>
      </ul>
      <div class="modal-actions">
        <button type="button" class="btn-primary" @click="finish">{{ t('common.close') }}</button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.hint,
.preview,
.field-label {
  margin: 0 0 0.6rem;
  color: var(--color-text-muted, #656d76);
  font-size: 13px;
}

.field-label {
  font-weight: 600;
  color: var(--color-text);
}

.root-btn {
  display: block;
  width: 100%;
  margin-bottom: 0.4rem;
  text-align: left;
  border: 1px solid var(--color-border, #d0d7de);
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  color: inherit;
}

.root-btn.active {
  background: color-mix(in srgb, var(--color-border, #d0d7de) 35%, transparent);
}

.root-btn:disabled {
  cursor: default;
}

.tree-wrap {
  max-height: 36vh;
  overflow: auto;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
  padding: 0.4rem;
  margin-bottom: 0.75rem;
}

.busy {
  pointer-events: none;
  opacity: 0.55;
}

.progress {
  margin: 0 0 1rem;
}

.progress-label {
  margin: 0 0 0.45rem;
  font-size: 13px;
  color: var(--color-text);
}

.progress-meta {
  margin: 0.4rem 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  word-break: break-all;
}

.progress-track {
  height: 6px;
  border-radius: 999px;
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}

.progress-bar.indeterminate {
  width: 36%;
  animation: import-progress-slide 1.2s ease-in-out infinite;
}

.remap,
.warnings {
  margin: 0 0 0.75rem;
  padding-left: 1.2rem;
  font-size: 12px;
}

.warnings {
  color: var(--color-warning);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (prefers-reduced-motion: no-preference) {
  .progress-bar:not(.indeterminate) {
    transition: width 0.2s ease;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar.indeterminate {
    width: 100%;
    animation: none;
    opacity: 0.7;
  }
}

@keyframes import-progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(280%);
  }
}
</style>
