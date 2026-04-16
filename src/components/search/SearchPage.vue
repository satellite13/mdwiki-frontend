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
    <p v-if="query" class="query-info">Results for "<strong>{{ query }}</strong>"</p>
    <div v-if="loading" class="state-placeholder">Searching...</div>
    <div v-else-if="results.length === 0" class="state-placeholder">No results found.</div>
    <ul v-else class="results">
      <li v-for="(r, index) in results" :key="r.pageId" class="result-card" :style="{ animationDelay: `${Math.min(index, 15) * 0.05}s` }">
        <router-link :to="`/page/${r.slug}`">
          <h3>{{ r.title }}</h3>
          <p class="snippet">{{ r.snippet }}</p>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-page h1 {
  font-family: var(--font-body);
  margin-bottom: 8px;
}

.query-info {
  color: var(--color-text-muted);
  margin-bottom: 28px;
  font-size: 15px;
}

.query-info strong {
  color: var(--color-text);
}

.results {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 18px 20px;
  transition: all 0.15s ease;
  background: var(--color-bg);
  animation: fadeInUpStagger 0.4s ease both;
}

.result-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow);
}

.result-card a {
  text-decoration: none;
  color: inherit;
}

.result-card h3 {
  font-family: var(--font-body);
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.snippet {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

</style>
