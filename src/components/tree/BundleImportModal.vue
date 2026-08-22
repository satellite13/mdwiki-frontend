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

function foldersOnlyTree(nodes: FolderTreeNode[]): FolderTreeNode[] {
  return nodes
    .filter((node) => node.type === 'folder')
    .map((node) => ({ ...node, children: foldersOnlyTree(node.children) }))
}

const foldersOnly = computed(() => foldersOnlyTree(props.tree))

async function submit() {
  loading.value = true
  try {
    const { data } = await bundlesApi.importBundle(props.file, targetId.value)
    result.value = data
    invalidatePageIndex()
    await folderStore.fetchTree(true)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('bundle.importFailed')))
  } finally {
    loading.value = false
  }
}

function finish() {
  emit('close')
}
</script>

<template>
  <AppModal :label="t('bundle.importTitle')" wide @close="emit('close')">
    <h2>{{ t('bundle.importTitle') }}</h2>
    <p class="hint">{{ t('bundle.importHint', { name: file.name }) }}</p>

    <template v-if="!result">
      <p class="field-label">{{ t('bundle.targetFolder') }}</p>
      <button
        type="button"
        class="root-btn"
        :class="{ active: targetId === null }"
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
      <div class="modal-actions">
        <button type="button" class="btn-secondary" :disabled="loading" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn-primary" :disabled="loading" @click="submit">
          {{ loading ? '…' : t('bundle.importAction') }}
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

.tree-wrap {
  max-height: 36vh;
  overflow: auto;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
  padding: 0.4rem;
  margin-bottom: 0.75rem;
}

.remap,
.warnings {
  margin: 0 0 0.75rem;
  padding-left: 1.2rem;
  font-size: 12px;
}

.warnings {
  color: #a40;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
