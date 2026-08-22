<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import SelectableDocumentTree from '@/components/tree/SelectableDocumentTree.vue'
import * as bundlesApi from '@/api/bundles'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { bundleExportPayload, toggleBundleSelection } from '@/utils/folderTree'
import type { BundlePreviewResponse, FolderTreeNode } from '@/types'

const props = defineProps<{
  tree: FolderTreeNode[]
  initialNodeId?: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const dialog = useDialogStore()
const selected = ref<Set<string>>(new Set())
const preview = ref<BundlePreviewResponse | null>(null)
const loading = ref(false)

watch(
  () => props.initialNodeId,
  (nodeId) => {
    selected.value = nodeId ? toggleBundleSelection(props.tree, new Set(), nodeId) : new Set()
    preview.value = null
  },
  { immediate: true }
)

const payload = computed(() => bundleExportPayload(props.tree, selected.value))
const canExport = computed(() => payload.value.pageSlugs.length > 0 || payload.value.folderIds.length > 0)

function onToggle(nodeId: string) {
  selected.value = toggleBundleSelection(props.tree, selected.value, nodeId)
  preview.value = null
}

async function loadPreview() {
  if (!canExport.value) return
  loading.value = true
  try {
    const { data } = await bundlesApi.previewBundle(payload.value)
    preview.value = data
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('bundle.previewFailed')))
  } finally {
    loading.value = false
  }
}

async function download() {
  if (!canExport.value) return
  loading.value = true
  try {
    if (!preview.value) {
      const { data } = await bundlesApi.previewBundle(payload.value)
      preview.value = data
    }
    await bundlesApi.exportBundle(payload.value)
    emit('close')
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('bundle.exportFailed')))
  } finally {
    loading.value = false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <AppModal :label="t('bundle.exportTitle')" wide @close="emit('close')">
    <h2>{{ t('bundle.exportTitle') }}</h2>
    <p class="hint">{{ t('bundle.exportHint') }}</p>

    <div class="tree-wrap">
      <SelectableDocumentTree :nodes="tree" :selected="selected" @toggle="onToggle" />
    </div>

    <p v-if="preview" class="preview">
      {{
        t('bundle.previewSummary', {
          pages: preview.pages.length,
          attachments: preview.attachmentCount,
          size: formatBytes(preview.attachmentBytes)
        })
      }}
    </p>
    <ul v-if="preview && preview.warnings.length" class="warnings">
      <li v-for="warning in preview.warnings" :key="warning">{{ warning }}</li>
    </ul>

    <div class="modal-actions">
      <button type="button" class="btn-secondary" :disabled="loading" @click="emit('close')">
        {{ t('common.cancel') }}
      </button>
      <button type="button" class="btn-secondary" :disabled="!canExport || loading" @click="loadPreview">
        {{ t('bundle.preview') }}
      </button>
      <button type="button" class="btn-primary" :disabled="!canExport || loading" @click="download">
        {{ loading ? '…' : t('bundle.download') }}
      </button>
    </div>
  </AppModal>
</template>

<style scoped>
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.hint,
.preview {
  margin: 0 0 0.75rem;
  color: var(--color-text-muted, #656d76);
  font-size: 13px;
}

.tree-wrap {
  max-height: 42vh;
  overflow: auto;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
  padding: 0.4rem;
  margin-bottom: 0.75rem;
}

.warnings {
  margin: 0 0 0.75rem;
  padding-left: 1.2rem;
  color: #a40;
  font-size: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
