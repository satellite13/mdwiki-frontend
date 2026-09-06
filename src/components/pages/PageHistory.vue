<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import * as pages from '@/api/pages'
import type { RevisionSnapshot, RevisionSummary } from '@/types'
import { diffRows } from '@/utils/diffRows'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { useDialogStore } from '@/stores/dialog'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const dialog = useDialogStore()
const slug = computed(() => String(route.params.slug))
const revisions = ref<RevisionSummary[]>([])
const before = ref<RevisionSnapshot | null>(null)
const after = ref<RevisionSnapshot | null>(null)
const loading = ref(true)
const error = ref('')
const conflict = ref(false)
let listRequestId = 0
let selectionRequestId = 0

const diff = computed(() => before.value && after.value
  ? diffRows(before.value.contentMd, after.value.contentMd)
  : { rows: [], truncated: false })
const rows = computed(() => diff.value.rows)

function operationLabel(operation: RevisionSummary['operation']): string {
  return t(`history.operations.${operation}`)
}

function revisionOption(r: RevisionSummary): string {
  const when = r.createdAt
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.createdAt))
    : ''
  return when
    ? `#${r.revisionNo} · ${operationLabel(r.operation)} · ${when}`
    : `#${r.revisionNo} · ${operationLabel(r.operation)}`
}

const revisionOptions = computed(() =>
  revisions.value.map((r) => ({ value: String(r.revisionNo), label: revisionOption(r) }))
)

async function loadList() {
  const id = ++listRequestId
  const requestSlug = slug.value
  loading.value = true
  error.value = ''
  try {
    const nextRevisions = (await pages.listRevisions(requestSlug, { limit: 50 })).data
    if (id !== listRequestId || slug.value !== requestSlug) return
    revisions.value = nextRevisions
    if (nextRevisions.length === 0) return
    const routeFrom = Number(route.query.from)
    const routeTo = Number(route.query.to)
    const to = revisions.value.some(r => r.revisionNo === routeTo) ? routeTo : revisions.value[0]!.revisionNo
    const from = revisions.value.some(r => r.revisionNo === routeFrom)
      ? routeFrom
      : revisions.value[1]?.revisionNo ?? to
    await select(from, to, true)
  } catch (e) {
    if (id === listRequestId) error.value = getApiErrorMessage(e, t('history.loadFailed'))
  } finally {
    if (id === listRequestId) loading.value = false
  }
}

async function select(from: number, to: number, canonical = false) {
  const id = ++selectionRequestId
  const requestSlug = slug.value
  conflict.value = false
  if (canonical) await router.replace({ query: { ...route.query, from: String(from), to: String(to) } })
  try {
    const [left, right] = await Promise.all([pages.getRevision(requestSlug, from), pages.getRevision(requestSlug, to)])
    if (id !== selectionRequestId || slug.value !== requestSlug) return
    before.value = left.data
    after.value = right.data
  } catch (e) {
    if (id === selectionRequestId) error.value = getApiErrorMessage(e, t('history.loadFailed'))
  }
}

async function restore() {
  if (!before.value) return
  const revisionNo = before.value.revisionNo
  if (!await dialog.confirm(t('history.restoreConfirm', { revision: revisionNo }))) return
  try {
    const current = (await pages.getPage(slug.value)).data
    const restored = (await pages.restoreRevision(slug.value, revisionNo, current.updatedAt)).data
    await router.replace(`/page/${encodeURIComponent(restored.slug)}`)
  } catch (e) {
    if (isApiErrorWithStatus(e, 409)) conflict.value = true
    else error.value = getApiErrorMessage(e, t('history.restoreFailed'))
  }
}

onMounted(loadList)
watch(() => [route.query.from, route.query.to], () => {
  const from = Number(route.query.from); const to = Number(route.query.to)
  if (from && to) void select(from, to)
})
watch(() => route.params.slug, () => {
  listRequestId++
  selectionRequestId++
  revisions.value = []
  before.value = null
  after.value = null
  error.value = ''
  conflict.value = false
  loading.value = true
  void loadList()
})
</script>

<template>
  <main class="grouped-page history-page">
    <div class="page-header">
      <div>
        <div class="title-row">
          <h1>
            {{ t('history.title') }}
            <HelpTip :label="t('history.title')">
              <p>{{ t('history.subtitle') }}</p>
            </HelpTip>
          </h1>
        </div>
      </div>
      <router-link class="btn-secondary history-back" :to="`/page/${encodeURIComponent(slug)}`">
        {{ t('history.back') }}
      </router-link>
    </div>

    <p v-if="loading" class="state-placeholder" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="empty-state" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn-secondary" @click="loadList">{{ t('common.retry') }}</button>
    </div>
    <div v-else-if="!revisions.length" class="empty-state">{{ t('history.empty') }}</div>
    <template v-else>
      <section class="group-card history-controls">
        <div class="selectors">
          <label>
            <span class="field-label-row">
              <span class="field-label">
                {{ t('history.before') }}
                <HelpTip :label="t('history.restoreHelpLabel')">
                  <p>{{ t('history.restoreHint') }}</p>
                </HelpTip>
              </span>
            </span>
            <AppSelect
              :model-value="before ? String(before.revisionNo) : null"
              :options="revisionOptions"
              searchable
              :aria-label="t('history.before')"
              @update:model-value="(value) => select(Number(value), after?.revisionNo ?? 1, true)"
            />
          </label>
          <label>
            <span class="field-label">{{ t('history.after') }}</span>
            <AppSelect
              :model-value="after ? String(after.revisionNo) : null"
              :options="revisionOptions"
              searchable
              :aria-label="t('history.after')"
              @update:model-value="(value) => select(before?.revisionNo ?? 1, Number(value), true)"
            />
          </label>
          <div v-if="auth.isEditor" class="restore-action">
            <button
              type="button"
              class="btn-primary"
              :disabled="!before"
              @click="restore"
            >
              {{ t('history.restore', { revision: before?.revisionNo ?? '—' }) }}
            </button>
          </div>
        </div>
        <p v-if="conflict" class="conflict" role="alert">
          {{ t('history.conflict') }}
          <button type="button" class="btn-secondary" @click="loadList">{{ t('common.retry') }}</button>
        </p>
      </section>

      <p v-if="diff.truncated" class="page-subtitle" role="status">{{ t('history.diffTruncated') }}</p>
      <section class="group-card">
        <div class="diff" role="table" :aria-label="t('history.diff')">
          <div v-for="(row, i) in rows" :key="i" :class="['diff-row', row.kind]" role="row">
            <span class="sr-only">
              {{ row.kind === 'remove' ? t('history.removed') : row.kind === 'add' ? t('history.added') : t('history.unchanged') }}
            </span>
            <span class="diff-marker" aria-hidden="true">{{ row.kind === 'remove' ? '-' : row.kind === 'add' ? '+' : ' ' }}</span>
            <span class="diff-text">{{ row.kind === 'add' ? (row.after ?? '') : (row.before ?? row.after ?? '') }}</span>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.history-controls {
  padding: 1rem 1.1rem;
}

.selectors {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.selectors label {
  display: grid;
  gap: 0.35rem;
  min-width: min(100%, 16rem);
  flex: 1 1 14rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted, #656d76);
}

.selectors :deep(.app-select) {
  width: 100%;
}

.restore-action {
  display: flex;
  align-items: flex-end;
  margin-left: auto;
}

.conflict {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1rem 0 0;
  color: var(--color-danger, #cf222e);
}

.diff {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.45;
  overflow: auto;
  background: var(--color-bg);
}

.diff-row {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  gap: 0.35rem;
  padding: 0.1rem 0.65rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
}

.diff-marker {
  user-select: none;
  text-align: center;
  font-weight: 700;
}

.diff-row.context .diff-marker {
  color: var(--color-text-faint);
}

.diff-row.remove {
  color: #cf222e;
  background: color-mix(in srgb, #cf222e 8%, transparent);
}

.diff-row.add {
  color: #1a7f37;
  background: color-mix(in srgb, #1a7f37 8%, transparent);
}

:global([data-theme='dark']) .diff-row.remove {
  color: #ff7b72;
  background: color-mix(in srgb, #ff7b72 12%, transparent);
}

:global([data-theme='dark']) .diff-row.add {
  color: #3fb950;
  background: color-mix(in srgb, #3fb950 12%, transparent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

@media (max-width: 767px) {
  .selectors {
    flex-direction: column;
    align-items: stretch;
  }

  .restore-action {
    margin-left: 0;
  }
}
</style>
