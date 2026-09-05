<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/savedSearches'
import type { SavedSearch } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const items = ref<SavedSearch[]>([])
const loading = ref(true)
const error = ref('')
let requestId = 0
async function load() {
  const id = ++requestId; loading.value = true; error.value = ''
  try { const { data } = await api.listSavedSearches(); if (id === requestId) items.value = data }
  catch (e) { if (id === requestId) error.value = getApiErrorMessage(e, t('savedSearches.loadFailed')) }
  finally { if (id === requestId) loading.value = false }
}
async function remove(item: SavedSearch) {
  if (!confirm(t('savedSearches.deleteConfirm', { name: item.name }))) return
  try { await api.deleteSavedSearch(item.id); await load() }
  catch (e) { error.value = getApiErrorMessage(e, t('savedSearches.deleteFailed')) }
}
onMounted(load)
</script>
<template>
  <main><h1>{{ t('savedSearches.title') }}</h1>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" role="alert">{{ error }} <button @click="load">{{ t('common.retry') }}</button></div>
    <p v-else-if="!items.length">{{ t('savedSearches.empty') }}</p>
    <ul v-else><li v-for="item in items" :key="item.id">
      <router-link :to="{ name: 'search', query: { saved: item.id, q: item.queryText, mode: item.mode.toLowerCase() } }">{{ item.name }}</router-link>
      <button :aria-label="t('savedSearches.deleteName', { name: item.name })" @click="remove(item)">{{ t('common.delete') }}</button>
    </li></ul>
  </main>
</template>
<style scoped>main{display:grid;gap:16px}ul{list-style:none;display:grid;gap:8px}li{display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border);border-radius:8px}</style>
