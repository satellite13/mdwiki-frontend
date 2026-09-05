<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as viewsApi from '@/api/views'
import * as propertiesApi from '@/api/properties'
import { useI18n } from 'vue-i18n'
import type { PropertyDefinition, SavedView, ViewRunItem } from '@/types'

const { t } = useI18n()
const views = ref<SavedView[]>([])
const definitions = ref<PropertyDefinition[]>([])
const items = ref<ViewRunItem[]>([])
const name = ref('')
const sortKey = ref('')
const groupKey = ref('')
const type = ref<SavedView['type']>('TABLE')
const error = ref('')
const loading = ref(false)
async function load() { try { [views.value, definitions.value] = await Promise.all([viewsApi.listViews().then(r => r.data), propertiesApi.listPropertyDefinitions().then(r => r.data)]) } catch { error.value = t('views.loadFailed') } }
async function create() {
  if (!name.value.trim()) return
  try { await viewsApi.createView({ name: name.value.trim(), type: type.value, filters: [], sort: sortKey.value ? [{ key: sortKey.value, direction: 'ASC' }] : [], grouping: groupKey.value ? { key: groupKey.value } : null, layout: {} }); name.value = ''; await load() }
  catch { error.value = t('views.createFailed') }
}
async function run(view: SavedView) {
  loading.value = true
  try { items.value = (await viewsApi.runView(view.id)).data.items ?? [] } catch { error.value = t('views.runFailed') }
  finally { loading.value = false }
}
async function remove(view: SavedView) { await viewsApi.deleteView(view.id); await load() }
onMounted(load)
</script>
<template>
  <main class="views-page">
    <h1>{{ t('views.title') }}</h1><p v-if="error" role="alert">{{ error }}</p>
    <form @submit.prevent="create"><label>{{ t('views.name') }} <input v-model="name" required></label><label>{{ t('views.layout') }} <select v-model="type"><option value="TABLE">{{ t('views.table') }}</option><option value="LIST">{{ t('views.list') }}</option><option value="CARDS">{{ t('views.cards') }}</option></select></label><label>{{ t('views.sort') }} <select v-model="sortKey"><option value="">{{ t('views.none') }}</option><option v-for="definition in definitions" :key="definition.id" :value="definition.key">{{ definition.displayName }}</option></select></label><label>{{ t('views.group') }} <select v-model="groupKey"><option value="">{{ t('views.none') }}</option><option v-for="definition in definitions" :key="definition.id" :value="definition.key">{{ definition.displayName }}</option></select></label><button type="submit">{{ t('views.create') }}</button></form>
    <ul :aria-label="t('views.title')"><li v-for="view in views" :key="view.id">
      <button @click="run(view)">{{ view.name }}</button> <span>{{ view.type }}</span>
      <button :aria-label="t('views.deleteNamed', { name: view.name })" @click="remove(view)">{{ t('views.delete') }}</button>
    </li></ul>
    <p v-if="loading">{{ t('views.loading') }}</p><p v-else-if="!items.length">{{ t('views.empty') }}</p>
    <div v-else class="table-scroll"><table><caption>{{ t('views.results') }}</caption><thead><tr><th aria-sort="none">{{ t('views.titleColumn') }}</th><th>{{ t('views.group') }}</th></tr></thead>
      <tbody><tr v-for="item in items" :key="item.page.id"><td><router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link></td><td>{{ item.groupKey ?? '—' }}</td></tr></tbody></table></div>
  </main>
</template>
<style scoped>.views-page { max-width: 60rem; padding: 1rem; } form, li { display:flex; gap:.5rem; align-items:center; margin:.5rem 0; flex-wrap:wrap } label { display:grid; gap:.2rem } .table-scroll { overflow-x:auto } table { width:100%; border-collapse:collapse; } th { position:sticky; top:0; background:var(--color-bg,#fff) } th,td { text-align:left; padding:.5rem; border-bottom:1px solid #ddd; } @media(max-width:600px){.views-page{padding:.75rem} form{align-items:flex-start; flex-direction:column}}</style>
