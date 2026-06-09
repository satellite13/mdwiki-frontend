<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as searchApi from '@/api/search'
import type { RagSearchResult } from '@/types'
import { useDialogStore } from '@/stores/dialog'
import { useTagStore } from '@/stores/tags'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const route = useRoute()
const dialog = useDialogStore()
const tagStore = useTagStore()
const results = ref<RagSearchResult[]>([])
const loading = ref(false)
const query = ref((route.query.q as string) || '')
const selectedTag = ref<string | null>(null)
const minScore = ref<number>(0)

const scoreOptions = [
  { label: 'All scores', value: 0 },
  { label: '50%+', value: 0.5 },
  { label: '75%+', value: 0.75 },
  { label: '90%+', value: 0.9 },
]

const resultTags = computed(() => {
  const tagSet = new Set<string>()
  for (const r of results.value) {
    for (const t of r.tags) {
      tagSet.add(t)
    }
  }
  return [...tagSet].sort()
})

const filteredResults = computed(() => {
  return results.value.filter(r => {
    if (r.score < minScore.value) return false
    if (selectedTag.value && !r.tags.includes(selectedTag.value)) return false
    return true
  })
})

function toggleTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

function highlightSnippet(snippet: string, q: string): string {
  if (!q.trim()) return snippet
  const words = q
    .split(/[\s,]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2)
  if (words.length === 0) return snippet
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return snippet.replace(pattern, '<mark class="search-highlight">$1</mark>')
}

async function doSearch() {
  if (!query.value.trim()) return
  loading.value = true
  try {
    const { data } = await searchApi.searchPagesRag(query.value)
    results.value = data
    selectedTag.value = null
    minScore.value = 0
  } catch (e) {
    results.value = []
    await dialog.alert(getApiErrorMessage(e, t.errors.searchFailed))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  doSearch()
  tagStore.fetchTags()
})
watch(() => route.query.q, (q) => { query.value = (q as string) || ''; doSearch() })
</script>

<template>
  <div class="search-page">
    <h1>Search Results</h1>
    <p v-if="query" class="query-info">Results for "<strong>{{ query }}</strong>"</p>

    <div v-if="results.length > 0" class="filters">
      <div v-if="resultTags.length > 0" class="tag-filter">
        <span class="filter-label">Tags:</span>
        <button
          v-for="tag in resultTags"
          :key="tag"
          :class="['tag-chip', { active: selectedTag === tag }]"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
        <button v-if="selectedTag" class="tag-chip clear" @click="selectedTag = null">clear</button>
      </div>

      <div class="score-filter">
        <span class="filter-label">Score:</span>
        <select v-model.number="minScore" class="score-select">
          <option v-for="o in scoreOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="search" /></div>
    <div v-else-if="filteredResults.length === 0 && results.length > 0" class="state-placeholder">No results match the selected filters.</div>
    <div v-else-if="results.length === 0" class="state-placeholder">No results found.</div>
    <ul v-else class="results">
      <li v-for="(r, index) in filteredResults" :key="r.pageSlug + index" class="result-card" :style="{ animationDelay: `${Math.min(index, 15) * 0.05}s` }">
        <router-link :to="`/page/${r.pageSlug}`">
          <div class="card-header">
            <h3>{{ r.pageTitle }}</h3>
            <span class="score">{{ (r.score * 100).toFixed(0) }}%</span>
          </div>
          <p v-if="r.sectionHeading" class="section-heading">{{ r.sectionHeading }}</p>
          <p class="snippet" v-html="highlightSnippet(r.snippet, query)" />
          <div v-if="r.tags.length > 0" class="result-tags">
            <span v-for="tag in r.tags" :key="tag" class="result-tag">{{ tag }}</span>
          </div>
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

/* ── Filters ── */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-subtle, color-mix(in srgb, var(--color-bg) 96%, var(--color-border)));
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-right: 4px;
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.tag-chip {
  font-size: 12px;
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: var(--font-body);
}

.tag-chip:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.tag-chip.clear {
  border-color: transparent;
  color: var(--color-text-muted);
  font-style: italic;
}

.tag-chip.clear:hover {
  color: var(--color-text);
}

.score-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.score-select {
  font-size: 13px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  cursor: pointer;
}

.score-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* ── Search highlighting ── */
:deep(.search-highlight) {
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
  color: var(--color-primary);
  border-radius: 3px;
  padding: 0 3px;
}

/* ── Result tags ── */
.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.result-tag {
  font-size: 11px;
  padding: 1px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-muted);
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.card-header h3 {
  font-family: var(--font-body);
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.score {
  font-size: 13px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.section-heading {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.snippet {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
}

@media (max-width: 767px) {
  .search-page h1 {
    font-size: 1.35rem;
    margin-bottom: 4px;
  }

  .query-info {
    font-size: 14px;
    margin-bottom: 20px;
  }

  .filters {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .score-filter {
    margin-left: 0;
  }

  .results {
    gap: 10px;
  }

  .result-card {
    padding: 14px 16px;
  }

  .card-header h3 {
    font-size: 1rem;
  }

  .score {
    font-size: 12px;
  }

  .section-heading {
    font-size: 12px;
  }

  .snippet {
    font-size: 13px;
    line-height: 1.5;
  }
}

/* touch-friendly tap targets */
.result-card a {
  display: block;
  min-height: 44px;
}
</style>
