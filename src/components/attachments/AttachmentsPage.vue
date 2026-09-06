<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import * as attachmentsApi from '@/api/attachments'
import type { Attachment } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import { copyTextToClipboard } from '@/utils/clipboard'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const PAGE_SIZE = 20

const { t } = useI18n()
const auth = useAuthStore()
const dialog = useDialogStore()
const attachments = ref<Attachment[]>([])
const total = ref(0)
const page = ref(0)
const searchInput = ref('')
const query = ref('')
const loading = ref(true)
const uploading = ref(false)
const dragOver = ref(false)

let controller: AbortController | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const from = computed(() => (total.value === 0 ? 0 : page.value * PAGE_SIZE + 1))
const to = computed(() => Math.min((page.value + 1) * PAGE_SIZE, total.value))
const canPrev = computed(() => page.value > 0)
const canNext = computed(() => (page.value + 1) * PAGE_SIZE < total.value)
const showNoResults = computed(
  () => !loading.value && attachments.value.length === 0 && !!query.value.trim()
)
const showEmpty = computed(
  () => !loading.value && attachments.value.length === 0 && !query.value.trim()
)

async function fetchAttachments() {
  controller?.abort()
  const next = new AbortController()
  controller = next
  loading.value = true
  try {
    const result = await attachmentsApi.listAttachments({
      page: page.value,
      size: PAGE_SIZE,
      q: query.value,
      signal: next.signal,
    })
    attachments.value = result.items
    total.value = result.total
    if (attachments.value.length === 0 && page.value > 0 && total.value > 0) {
      page.value -= 1
      await fetchAttachments()
    }
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_CANCELED') return
    await dialog.alert(getApiErrorMessage(e, t('errors.loadAttachmentsFailed')))
  } finally {
    if (controller === next) {
      loading.value = false
    }
  }
}

watch(searchInput, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    query.value = value.trim()
    page.value = 0
    void fetchAttachments()
  }, 300)
})

function goPrev() {
  if (!canPrev.value) return
  page.value -= 1
  void fetchAttachments()
}

function goNext() {
  if (!canNext.value) return
  page.value += 1
  void fetchAttachments()
}

async function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      await attachmentsApi.uploadAttachment(file)
    }
    await fetchAttachments()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.uploadFailed')))
  } finally {
    uploading.value = false
  }
}

function onFileInput(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

async function deleteAttachment(att: Attachment) {
  const ok = await dialog.confirm(t('attachments.confirmDelete', { name: att.originalName }), {
    danger: true,
    confirmLabel: t('tree.delete')
  })
  if (!ok) return
  try {
    await attachmentsApi.deleteAttachment(att.id)
    await fetchAttachments()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.deleteAttachmentFailed')))
  }
}

async function copyLink(att: Attachment) {
  const isImage = att.contentType.startsWith('image/')
  const md = isImage ? `![${att.originalName}](${att.url})` : `[${att.originalName}](${att.url})`
  await copyTextToClipboard(md)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/')
}

onMounted(fetchAttachments)
onBeforeUnmount(() => {
  controller?.abort()
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="attachments-page">
    <h1>{{ t('attachments.title') }}</h1>

    <div
      v-if="auth.isEditor"
      :class="['upload-zone', { 'drag-over': dragOver }]"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
    >
      <p v-if="uploading">{{ t('attachments.uploading') }}</p>
      <p v-else>{{ t('attachments.dropHint') }} <label class="file-label"><input type="file" multiple @change="onFileInput" hidden />{{ t('attachments.browse') }}</label></p>
    </div>

    <div class="attachments-toolbar">
      <input
        data-testid="attachments-search"
        type="search"
        class="attachments-search"
        v-model="searchInput"
        :placeholder="t('attachments.searchPlaceholder')"
        :aria-label="t('attachments.searchPlaceholder')"
      />
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <div v-else-if="showEmpty" class="state-placeholder">{{ t('attachments.empty') }}</div>
    <div v-else-if="showNoResults" class="state-placeholder">{{ t('attachments.noResults') }}</div>
    <template v-else>
      <div class="table-scroll">
        <table class="data-table attachments-table">
          <thead>
            <tr>
              <th></th>
              <th>{{ t('attachments.colName') }}</th>
              <th>{{ t('attachments.colType') }}</th>
              <th>{{ t('attachments.colSize') }}</th>
              <th>{{ t('attachments.colUploadedBy') }}</th>
              <th>{{ t('attachments.colDate') }}</th>
              <th>{{ t('attachments.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="att in attachments" :key="att.id">
              <td class="preview-cell">
                <img v-if="isImage(att.contentType)" :src="att.url" class="thumb" :alt="att.originalName" />
                <span v-else class="file-icon">📎</span>
              </td>
              <td class="name-cell" :data-label="t('attachments.colName')">
                <a :href="att.url" target="_blank">{{ att.originalName }}</a>
              </td>
              <td class="type-cell" :data-label="t('attachments.colType')">{{ att.contentType }}</td>
              <td class="size-cell" :data-label="t('attachments.colSize')">{{ formatSize(att.sizeBytes) }}</td>
              <td class="user-cell" :data-label="t('attachments.colUploadedBy')">{{ att.uploadedBy || '—' }}</td>
              <td class="date-cell" :data-label="t('attachments.colDate')">{{ new Date(att.createdAt).toLocaleDateString() }}</td>
              <td class="actions-cell">
                <div class="actions-inner">
                  <button class="btn-secondary btn-sm" type="button" @click="copyLink(att)" :title="t('attachments.copyMarkdownLink')">{{ t('attachments.copyLink') }}</button>
                  <button v-if="auth.isEditor" class="btn-danger btn-sm" type="button" @click="deleteAttachment(att)">{{ t('tree.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav
        v-if="total > 0"
        class="attachments-pagination"
        :aria-label="t('attachments.title')"
      >
        <span class="attachments-range">
          {{ t('attachments.range', { from, to, total }) }}
        </span>
        <div class="attachments-page-actions">
          <button
            type="button"
            class="btn-secondary btn-sm"
            data-testid="attachments-prev"
            :disabled="!canPrev"
            @click="goPrev"
          >{{ t('attachments.prevPage') }}</button>
          <button
            type="button"
            class="btn-secondary btn-sm"
            data-testid="attachments-next"
            :disabled="!canNext"
            @click="goNext"
          >{{ t('attachments.nextPage') }}</button>
        </div>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.attachments-page h1 { margin-bottom: 20px; }

.attachments-toolbar {
  display: flex;
  margin-bottom: 16px;
}

.attachments-search {
  width: 100%;
  max-width: 28rem;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
}

.attachments-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.attachments-range {
  color: var(--color-text-muted);
  font-size: 13px;
}

.attachments-page-actions {
  display: flex;
  gap: 8px;
}

.attachments-table tbody td {
  vertical-align: middle;
}

.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 32px;
  text-align: center;
  margin-bottom: 24px;
  color: var(--color-text-muted);
  transition: all 0.15s;
}

.upload-zone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-light, rgba(13, 148, 136, 0.05));
  color: var(--color-primary);
}

.file-label {
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}

.thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.file-icon { font-size: 20px; }
.preview-cell { width: 50px; text-align: center; }
.name-cell a { font-weight: 500; }
.type-cell { font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted); }
.size-cell { font-family: var(--font-mono); font-size: 13px; }
.user-cell { color: var(--color-text-muted); font-size: 13px; }
.date-cell { font-family: var(--font-mono); font-size: 13px; color: var(--color-text-muted); }
/* flex на <td> снимает table-cell и даёт строке меньшую высоту — flex только во внутреннем блоке */
.actions-cell {
  white-space: nowrap;
}
.actions-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.btn-sm { padding: 4px 10px; font-size: 12px; }

@media (max-width: 767px) {
  .upload-zone {
    padding: 20px 16px;
    margin-bottom: 16px;
  }

  .attachments-page h1 {
    font-size: 1.35rem;
  }

  .attachments-search {
    max-width: none;
  }

  .attachments-table thead {
    display: none;
  }

  .attachments-table,
  .attachments-table tbody,
  .attachments-table tr,
  .attachments-table td {
    display: block;
  }

  .attachments-table tr {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
    background: var(--color-bg);
    box-shadow: var(--shadow);
  }

  .attachments-table td {
    padding: 3px 0;
    border-bottom: none;
    text-align: left;
  }

  .attachments-table td::before {
    content: attr(data-label);
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--color-text-muted);
    width: 90px;
    flex-shrink: 0;
  }

  .preview-cell {
    margin-bottom: 8px;
  }

  .preview-cell::before {
    display: none !important;
  }

  .preview-cell .thumb {
    width: 56px;
    height: 56px;
  }

  .name-cell {
    margin-bottom: 6px;
  }

  .name-cell::before {
    display: none !important;
  }

  .name-cell a {
    font-weight: 600;
    font-size: 15px;
  }

  .actions-cell {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border);
  }

  .actions-cell::before {
    display: none !important;
  }

  .btn-sm {
    min-height: 36px;
    min-width: 44px;
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>
