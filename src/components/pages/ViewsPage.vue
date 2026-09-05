<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as viewsApi from '@/api/views'
import type { SavedView } from '@/types'

const views = ref<SavedView[]>([])
const items = ref<{ id: string, slug: string, title: string }[]>([])
const name = ref('')
const error = ref('')
async function load() { try { views.value = (await viewsApi.listViews()).data } catch { error.value = 'Could not load views' } }
async function create() {
  if (!name.value.trim()) return
  try { await viewsApi.createView({ name: name.value.trim(), type: 'TABLE', filters: [], sort: [], grouping: null, layout: {} }); name.value = ''; await load() }
  catch { error.value = 'Could not create view' }
}
async function run(view: SavedView) {
  try { items.value = (await viewsApi.runView(view.id)).data.items ?? [] } catch { error.value = 'Could not run view' }
}
async function remove(view: SavedView) { await viewsApi.deleteView(view.id); await load() }
onMounted(load)
</script>
<template>
  <main class="views-page">
    <h1>Views</h1><p v-if="error" role="alert">{{ error }}</p>
    <form @submit.prevent="create"><label>View name <input v-model="name" required></label><button type="submit">Create table</button></form>
    <ul aria-label="Saved views"><li v-for="view in views" :key="view.id">
      <button @click="run(view)">{{ view.name }}</button> <span>{{ view.type }}</span>
      <button :aria-label="`Delete ${view.name}`" @click="remove(view)">Delete</button>
    </li></ul>
    <table v-if="items.length"><caption>View results</caption><thead><tr><th>Title</th></tr></thead>
      <tbody><tr v-for="item in items" :key="item.id"><td><router-link :to="`/page/${item.slug}`">{{ item.title }}</router-link></td></tr></tbody></table>
  </main>
</template>
<style scoped>.views-page { max-width: 60rem; padding: 1rem; } form, li { display:flex; gap:.5rem; align-items:center; margin:.5rem 0; } table { width:100%; border-collapse:collapse; } th,td { text-align:left; padding:.5rem; border-bottom:1px solid #ddd; } @media(max-width:600px){.views-page{padding:.75rem} form{align-items:flex-start; flex-direction:column}}</style>
