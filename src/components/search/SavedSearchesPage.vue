<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/savedSearches'
import * as libraryApi from '@/api/library'
import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import { useDialogStore } from '@/stores/dialog'
import AppSelect from '@/components/ui/AppSelect.vue'

const { t } = useI18n()
const dialog = useDialogStore()
const items = ref<SavedSearch[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const editing = ref<SavedSearch | null>(null)
const name = ref('')
const queryText = ref('')
const mode = ref<SavedSearchMode>('HYBRID')
const tagsText = ref('')
const minScore = ref<number | null>(null)
const sort = ref<SavedSearchSort>('RELEVANCE')
const formOpen = ref(false)
const favoriteBusyId = ref<string | null>(null)
const formTitle = computed(() => editing.value ? t('savedSearches.editTitle') : t('savedSearches.createTitle'))
const modeOptions = [
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'TEXT', label: 'Text' },
  { value: 'SEMANTIC', label: 'Semantic' },
]
const sortOptions = computed(() => [
  { value: 'RELEVANCE', label: t('savedSearches.relevance') },
  { value: 'UPDATED', label: t('savedSearches.updated') },
])
let requestId = 0

async function load() {
  const id = ++requestId; loading.value = true; error.value = ''
  try { const { data } = await api.listSavedSearches(); if (id === requestId) items.value = data }
  catch (e) { if (id === requestId) error.value = getApiErrorMessage(e, t('savedSearches.loadFailed')) }
  finally { if (id === requestId) loading.value = false }
}

function openCreate() {
  editing.value = null; name.value = ''; queryText.value = ''; mode.value = 'HYBRID'
  tagsText.value = ''; minScore.value = null; sort.value = 'RELEVANCE'; formOpen.value = true
}

function openEdit(item: SavedSearch) {
  editing.value = item; name.value = item.name; queryText.value = item.queryText; mode.value = item.mode
  tagsText.value = item.tags.join(', '); minScore.value = item.minScore; sort.value = item.sort; formOpen.value = true
}

async function save() {
  if (!name.value.trim() || !queryText.value.trim() || saving.value) return
  saving.value = true; error.value = ''
  const input = {
    name: name.value.trim(), queryText: queryText.value.trim(), mode: mode.value,
    tags: tagsText.value.split(',').map(tag => tag.trim()).filter(Boolean),
    minScore: minScore.value, sort: sort.value,
  }
  try {
    if (editing.value) await api.updateSavedSearch(editing.value.id, {
      ...input, expectedVersion: editing.value.version,
    })
    else await api.createSavedSearch(input)
    formOpen.value = false
    await load()
  } catch (e) {
    error.value = getApiErrorMessage(e, t('savedSearches.saveFailed'))
  } finally { saving.value = false }
}

async function remove(item: SavedSearch) {
  if (!await dialog.confirm(t('savedSearches.deleteConfirm', { name: item.name }), { danger: true })) return
  try { await api.deleteSavedSearch(item.id); await load() }
  catch (e) { error.value = getApiErrorMessage(e, t('savedSearches.deleteFailed')) }
}

async function toggleFavorite(item: SavedSearch) {
  if (favoriteBusyId.value === item.id) return
  const previous = item.favorited
  item.favorited = !previous
  favoriteBusyId.value = item.id
  try {
    if (item.favorited) await libraryApi.addFavoriteSearch(item.id)
    else await libraryApi.removeFavoriteSearch(item.id)
  } catch (e) {
    item.favorited = previous
    await dialog.alert(getApiErrorMessage(e, t('pkm.favoriteFailed')))
  } finally {
    if (favoriteBusyId.value === item.id) favoriteBusyId.value = null
  }
}
onMounted(load)
</script>
<template>
  <main>
    <header><h1>{{ t('savedSearches.title') }}</h1><button class="btn-primary" @click="openCreate">{{ t('savedSearches.create') }}</button></header>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" role="alert">{{ error }} <button @click="load">{{ t('common.retry') }}</button></div>
    <p v-else-if="!items.length">{{ t('savedSearches.empty') }}</p>
    <ul v-else><li v-for="item in items" :key="item.id">
      <router-link :to="{ name: 'search', query: { saved: item.id, q: item.queryText, mode: item.mode.toLowerCase() } }">{{ item.name }}</router-link>
      <span class="actions">
        <button
          type="button"
          class="favorite-btn"
          :class="{ active: item.favorited }"
          :aria-label="item.favorited ? t('pkm.removeFavorite') : t('pkm.addFavorite')"
          :aria-pressed="item.favorited"
          :aria-busy="favoriteBusyId === item.id"
          :disabled="favoriteBusyId === item.id"
          @click="toggleFavorite(item)"
        >
          <span class="material-symbols-outlined notranslate" translate="no">{{ item.favorited ? 'star' : 'star_outline' }}</span>
        </button>
        <button :aria-label="t('savedSearches.editName', { name: item.name })" @click="openEdit(item)">{{ t('common.edit') }}</button>
        <button :aria-label="t('savedSearches.deleteName', { name: item.name })" @click="remove(item)">{{ t('common.delete') }}</button>
      </span>
    </li></ul>
    <form v-if="formOpen" class="saved-form" :aria-label="formTitle" @submit.prevent="save">
      <h2>{{ formTitle }}</h2>
      <label>{{ t('savedSearches.name') }}<input v-model="name" maxlength="120" required /></label>
      <label>{{ t('savedSearches.query') }}<input v-model="queryText" maxlength="1000" required /></label>
      <label>{{ t('savedSearches.mode') }}<AppSelect v-model="mode" :options="modeOptions" :aria-label="t('savedSearches.mode')" /></label>
      <label>{{ t('savedSearches.tags') }}<input v-model="tagsText" /></label>
      <label>{{ t('savedSearches.minScore') }}<input v-model.number="minScore" type="number" min="0" max="1" step="0.01" /></label>
      <label>{{ t('savedSearches.sort') }}<AppSelect v-model="sort" :options="sortOptions" :aria-label="t('savedSearches.sort')" /></label>
      <div class="actions"><button type="button" @click="formOpen = false">{{ t('common.cancel') }}</button><button class="btn-primary" :disabled="saving" type="submit">{{ t('common.save') }}</button></div>
    </form>
  </main>
</template>
<style scoped>
main{display:grid;gap:16px}
header,.actions{display:flex;gap:8px;align-items:center;justify-content:space-between}
ul{list-style:none;display:grid;gap:8px}
li{display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border);border-radius:8px}
.saved-form{display:grid;gap:12px;max-width:540px;padding:16px;border:1px solid var(--color-border);border-radius:8px}
.saved-form label{display:grid;gap:4px}
.favorite-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--color-border);border-radius:6px;background:transparent;color:var(--color-text-muted);cursor:pointer}
.favorite-btn.active{color:var(--color-primary);border-color:var(--color-primary)}
.favorite-btn:disabled{opacity:.6}
@media(max-width:767px){header,li{align-items:stretch;flex-direction:column}.saved-form{max-width:none}}
</style>
