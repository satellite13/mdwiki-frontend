<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as searchApi from '@/api/search'
import type { SearchResult } from '@/types'

const route = useRoute()
const results = ref<SearchResult[]>([])
const loading = ref(false)
const query = ref((route.query.q as string) || '')

async function doSearch() {
  if (!query.value.trim()) return
  loading.value = true
  try { const { data } = await searchApi.searchPages(query.value); results.value = data }
  finally { loading.value = false }
}

onMounted(doSearch)
watch(() => route.query.q, (q) => { query.value = (q as string) || ''; doSearch() })
</script>

<template>
  <div class="search-page">
    <h1>Search Results</h1>
    <p v-if="query" class="query-info">Results for "{{ query }}"</p>
    <div v-if="loading" class="loading">Searching...</div>
    <div v-else-if="results.length === 0" class="empty">No results found.</div>
    <ul v-else class="results">
      <li v-for="r in results" :key="r.pageId" class="result-card">
        <router-link :to="`/page/${r.slug}`">
          <h3>{{ r.title }}</h3>
          <p class="snippet">{{ r.snippet }}</p>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-page h1 { margin-bottom: 8px; }
.query-info { color: var(--color-text-muted); margin-bottom: 24px; }
.results { list-style: none; display: flex; flex-direction: column; gap: 12px; }
.result-card { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; }
.result-card a { text-decoration: none; color: inherit; }
.result-card h3 { margin-bottom: 4px; }
.snippet { font-size: 14px; color: var(--color-text-muted); }
.loading, .empty { color: var(--color-text-muted); padding: 40px 0; text-align: center; }
</style>
