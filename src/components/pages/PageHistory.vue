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

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()
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

const rows = computed(() => before.value && after.value
  ? diffRows(before.value.contentMd, after.value.contentMd).rows
  : [])

async function loadList() {
  const id = ++listRequestId
  loading.value = true
  error.value = ''
  try {
    revisions.value = (await pages.listRevisions(slug.value, { limit: 50 })).data
    if (id !== listRequestId || revisions.value.length === 0) return
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
  conflict.value = false
  if (canonical) await router.replace({ query: { ...route.query, from: String(from), to: String(to) } })
  try {
    const [left, right] = await Promise.all([pages.getRevision(slug.value, from), pages.getRevision(slug.value, to)])
    if (id !== selectionRequestId) return
    before.value = left.data
    after.value = right.data
  } catch (e) {
    if (id === selectionRequestId) error.value = getApiErrorMessage(e, t('history.loadFailed'))
  }
}

async function restore() {
  if (!before.value || !await dialog.confirm(t('history.restoreConfirm'))) return
  try {
    const current = (await pages.getPage(slug.value)).data
    const restored = (await pages.restoreRevision(slug.value, before.value.revisionNo, current.updatedAt)).data
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
</script>

<template>
  <main class="history-page">
    <header><h1>{{ t('history.title') }}</h1><router-link :to="`/page/${encodeURIComponent(slug)}`">{{ t('history.back') }}</router-link></header>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" role="alert"><p>{{ error }}</p><button @click="loadList">{{ t('common.retry') }}</button></div>
    <template v-else>
      <div class="selectors">
        <label>{{ t('history.before') }}<select :value="before?.revisionNo" @change="select(Number(($event.target as HTMLSelectElement).value), after?.revisionNo ?? 1, true)"><option v-for="r in revisions" :key="r.revisionNo" :value="r.revisionNo">#{{ r.revisionNo }} · {{ r.operation }}</option></select></label>
        <label>{{ t('history.after') }}<select :value="after?.revisionNo" @change="select(before?.revisionNo ?? 1, Number(($event.target as HTMLSelectElement).value), true)"><option v-for="r in revisions" :key="r.revisionNo" :value="r.revisionNo">#{{ r.revisionNo }} · {{ r.operation }}</option></select></label>
        <button v-if="auth.isEditor" @click="restore">{{ t('history.restore') }}</button>
      </div>
      <p v-if="conflict" role="alert">{{ t('history.conflict') }} <button @click="loadList">{{ t('common.retry') }}</button></p>
      <div class="diff" role="table" :aria-label="t('history.diff')">
        <div v-for="(row, i) in rows" :key="i" :class="['diff-row', row.kind]" role="row">
          <div role="cell"><span class="sr-only">{{ row.kind === 'remove' ? t('history.removed') : t('history.before') }}</span>{{ row.before ?? '' }}</div>
          <div role="cell"><span class="sr-only">{{ row.kind === 'add' ? t('history.added') : t('history.after') }}</span>{{ row.after ?? '' }}</div>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.history-page{display:grid;gap:16px}.history-page header,.selectors{display:flex;gap:12px;align-items:center;justify-content:space-between}.selectors label{display:grid;gap:4px}.diff{font-family:monospace;border:1px solid var(--color-border);overflow:auto}.diff-row{display:grid;grid-template-columns:1fr 1fr}.diff-row>div{white-space:pre-wrap;padding:2px 8px;border-right:1px solid var(--color-border)}.remove>div:first-child{background:#ffebe9}.add>div:last-child{background:#dafbe1}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:767px){.selectors{align-items:stretch;flex-direction:column}.diff-row{grid-template-columns:1fr}.diff-row>div:empty{display:none}}
</style>
