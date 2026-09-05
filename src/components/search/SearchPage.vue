<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as searchApi from '@/api/search'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { escapeHtml } from '@/utils/htmlEscape'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import {
  normalizeSearchResults,
  type NormalizedSearchResult
} from './normalizeSearchResults'
import type { AnswerResponse } from '@/types'
import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'
import * as savedSearchApi from '@/api/savedSearches'
import { isSavedSearchModified, normalizeSearchDefinition, savedSearchQuery } from './savedSearchState'
import { renderAnswerMarkdown } from './renderAnswerMarkdown'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const dialog = useDialogStore()
type SearchMode = 'hybrid' | 'text' | 'semantic'
const validModes: SearchMode[] = ['hybrid', 'text', 'semantic']
const hasValidRouteMode = () => validModes.includes(route.query.mode as SearchMode)
const routeMode = (): SearchMode =>
  hasValidRouteMode() ? route.query.mode as SearchMode : 'hybrid'
const mode = ref<SearchMode>(routeMode())
const results = ref<NormalizedSearchResult[]>([])
const loading = ref(false)
const warning = ref<string | null>(null)
const query = ref((route.query.q as string) || '')
const selectedTags = ref<string[]>([])
const minScore = ref<number>(0)
const sort = ref<SavedSearchSort>('RELEVANCE')
const activeSaved = ref<SavedSearch | null>(null)
const savedLoading = ref(false)
const currentDefinition = computed(() => normalizeSearchDefinition({
  queryText: query.value.trim(),
  mode: mode.value.toUpperCase() as SavedSearchMode,
  tags: selectedTags.value,
  minScore: minScore.value || null,
  sort: sort.value,
}))
const savedModified = computed(() => activeSaved.value
  ? isSavedSearchModified(activeSaved.value, currentDefinition.value)
  : false)
let searchRequestId = 0
let answerRequestId = 0
let savedRequestId = 0
let lastSearchedQuery = ''
let answerAbort: AbortController | null = null
const answer = ref<AnswerResponse | null>(null)
const answerLoading = ref(false)
const answerError = ref('')
const answerHtml = computed(() => answer.value ? renderAnswerMarkdown(answer.value.answerMd) : '')
const modes = computed(() => [
  { value: 'hybrid' as const, label: t('search.modeHybrid') },
  { value: 'text' as const, label: t('search.modeText') },
  { value: 'semantic' as const, label: t('search.modeSemantic') }
])

const scoreOptions = computed(() => [
  { label: t('search.allScores'), value: 0 },
  { label: '50%+', value: 0.5 },
  { label: '75%+', value: 0.75 },
  { label: '90%+', value: 0.9 },
])

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
  const filtered = results.value.filter(r => {
    if (r.score !== null && r.score < minScore.value) return false
    if (selectedTags.value.some(tag => !r.tags.includes(tag))) return false
    return true
  })
  return sort.value === 'UPDATED'
    ? [...filtered].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    : filtered
})

function toggleTag(tag: string) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter(selected => selected !== tag)
    : [...selectedTags.value, tag]
}

function highlightSnippet(snippet: string, q: string): string {
  // Сниппет приходит из пользовательского контента — сначала экранируем HTML,
  // затем подсвечиваем совпадения (иначе v-html открывает stored XSS).
  const safeSnippet = escapeHtml(snippet)
  if (!q.trim()) return safeSnippet
  const words = q
    .split(/[\s,]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2)
  if (words.length === 0) return safeSnippet
  const escaped = words.map(w => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return safeSnippet.replace(pattern, '<mark class="search-highlight">$1</mark>')
}

async function doSearch(searchMode: SearchMode = mode.value) {
  const requestId = ++searchRequestId
  const isCurrent = () => requestId === searchRequestId && mode.value === searchMode
  if (!query.value.trim()) {
    results.value = []
    loading.value = false
    warning.value = null
    if (!activeSaved.value) {
      selectedTags.value = []
      minScore.value = 0
    }
    return
  }
  const normalizedQuery = query.value.trim()
  if (!activeSaved.value && normalizedQuery !== lastSearchedQuery) {
    selectedTags.value = []
    minScore.value = 0
    sort.value = 'RELEVANCE'
  }
  lastSearchedQuery = normalizedQuery
  loading.value = true
  warning.value = null
  try {
    if (searchMode === 'text') {
      const { data } = await searchApi.searchPages(query.value)
      if (!isCurrent()) return
      results.value = normalizeSearchResults(data, [])
    } else if (searchMode === 'semantic') {
      const { data } = await searchApi.searchPagesRag(query.value)
      if (!isCurrent()) return
      results.value = normalizeSearchResults([], data)
    } else {
      const [text, semantic] = await Promise.allSettled([
        searchApi.searchPages(query.value),
        searchApi.searchPagesRag(query.value)
      ])
      if (!isCurrent()) return
      if (text.status === 'rejected' && semantic.status === 'rejected') {
        throw text.reason
      }
      const textResults = text.status === 'fulfilled' ? text.value.data : []
      const semanticResults = semantic.status === 'fulfilled' ? semantic.value.data : []
      results.value = normalizeSearchResults(textResults, semanticResults)
      if (semantic.status === 'rejected') warning.value = t('search.semanticUnavailable')
      if (text.status === 'rejected') warning.value = t('search.textUnavailable')
    }
  } catch (e) {
    if (!isCurrent()) return
    results.value = []
    await dialog.alert(getApiErrorMessage(e, t('errors.searchFailed')))
  } finally {
    if (isCurrent()) loading.value = false
  }
}

async function askAnswer() {
  const id = ++answerRequestId
  answerAbort?.abort()
  answerAbort = new AbortController()
  answerLoading.value = true
  answerError.value = ''
  try {
    const { data } = await searchApi.answerQuestion(query.value, 5, answerAbort.signal)
    if (id === answerRequestId) answer.value = data
  } catch (e) {
    if (id === answerRequestId) answerError.value = getApiErrorMessage(e, t('search.answerFailed'))
  } finally {
    if (id === answerRequestId) answerLoading.value = false
  }
}

async function hydrateSaved(id: string) {
  const requestId = ++savedRequestId
  savedLoading.value = true
  try {
    const { data } = await savedSearchApi.getSavedSearch(id)
    if (requestId !== savedRequestId || route.query.saved !== id) return
    activeSaved.value = data
    query.value = data.queryText
    mode.value = data.mode.toLowerCase() as SearchMode
    selectedTags.value = normalizeSearchDefinition(data).tags
    minScore.value = data.minScore ?? 0
    sort.value = data.sort
    await router.replace({ query: savedSearchQuery(data) })
    await doSearch(mode.value)
  } catch (e) {
    if (requestId === savedRequestId) {
      activeSaved.value = null
      await dialog.alert(getApiErrorMessage(e, t('savedSearches.loadOneFailed')))
    }
  } finally {
    if (requestId === savedRequestId) savedLoading.value = false
  }
}

async function saveAsNew() {
  const name = await dialog.prompt(t('savedSearches.namePrompt'))
  if (!name?.trim()) return
  try {
    const { data } = await savedSearchApi.createSavedSearch({ name: name.trim(), ...currentDefinition.value })
    activeSaved.value = data
    await router.replace({ query: savedSearchQuery(data) })
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('savedSearches.saveFailed')))
  }
}

async function updateSaved() {
  if (!activeSaved.value || !savedModified.value) return
  try {
    const { data } = await savedSearchApi.updateSavedSearch(activeSaved.value.id, {
      name: activeSaved.value.name,
      ...currentDefinition.value,
      expectedVersion: activeSaved.value.version,
    })
    activeSaved.value = data
    await router.replace({ query: savedSearchQuery(data) })
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('savedSearches.saveFailed')))
  }
}

async function deleteSaved() {
  if (!activeSaved.value || !await dialog.confirm(t('savedSearches.deleteConfirm', { name: activeSaved.value.name }), { danger: true })) return
  try {
    await savedSearchApi.deleteSavedSearch(activeSaved.value.id)
    activeSaved.value = null
    const queryWithoutSaved = { ...route.query }
    delete queryWithoutSaved.saved
    await router.replace({ query: queryWithoutSaved })
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('savedSearches.deleteFailed')))
  }
}

function setMode(nextMode: SearchMode) {
  if (mode.value === nextMode) return
  mode.value = nextMode
  searchRequestId++
  loading.value = false
  void navigateAndSearch(nextMode)
}

async function navigateAndSearch(nextMode: SearchMode) {
  try {
    await router.replace({ query: { ...route.query, mode: nextMode } })
    if (mode.value !== nextMode) return
    await doSearch(nextMode)
  } catch (error) {
    if (mode.value === nextMode) {
      loading.value = false
      await dialog.alert(getApiErrorMessage(error, t('errors.searchFailed')))
    }
  }
}

async function onModeKeydown(event: KeyboardEvent, index: number) {
  let nextIndex: number | null = null
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % modes.value.length
  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modes.value.length) % modes.value.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = modes.value.length - 1
  if (nextIndex === null) return
  event.preventDefault()
  const group = (event.currentTarget as HTMLElement).closest('[role="radiogroup"]')
  setMode(modes.value[nextIndex]!.value)
  await nextTick()
  group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
}

function resultLink(result: NormalizedSearchResult): string {
  const path = `/page/${encodeURIComponent(result.slug)}`
  return result.sectionKey
    ? `${path}?section=${encodeURIComponent(result.sectionKey)}`
    : path
}

async function canonicalizeMode() {
  if (!hasValidRouteMode()) {
    await router.replace({ query: { ...route.query, mode: 'hybrid' } })
  }
}

onMounted(async () => {
  if (typeof route.query.saved === 'string') {
    await hydrateSaved(route.query.saved)
    return
  }
  await canonicalizeMode()
  await doSearch()
})
watch(() => route.query.q, (q) => {
  query.value = (q as string) || ''
  answerRequestId++; answerAbort?.abort(); answer.value = null; answerError.value = ''; answerLoading.value = false
  doSearch()
})
watch(() => route.query.mode, async () => {
  const nextMode = routeMode()
  const changed = nextMode !== mode.value
  if (changed) mode.value = nextMode
  await canonicalizeMode()
  if (changed) void doSearch()
})
watch(() => route.query.saved, (saved) => {
  if (typeof saved === 'string' && saved !== activeSaved.value?.id) void hydrateSaved(saved)
  if (!saved) activeSaved.value = null
})
</script>

<template>
  <div class="search-page">
    <h1>{{ t('search.title') }}</h1>
    <p v-if="query" class="query-info">{{ t('search.resultsFor', { query }) }}</p>
    <nav class="saved-actions" :aria-label="t('savedSearches.actions')">
      <span v-if="activeSaved">{{ activeSaved.name }}<span v-if="savedModified"> · {{ t('savedSearches.modified') }}</span></span>
      <button v-if="activeSaved && savedModified" type="button" @click="updateSaved">{{ t('savedSearches.update') }}</button>
      <button type="button" :disabled="savedLoading || !query.trim()" @click="saveAsNew">{{ activeSaved ? t('savedSearches.saveAsNew') : t('savedSearches.saveSearch') }}</button>
      <button v-if="activeSaved" type="button" @click="deleteSaved">{{ t('common.delete') }}</button>
      <router-link to="/saved-searches">{{ t('savedSearches.manage') }}</router-link>
    </nav>

    <div class="search-modes" role="radiogroup" :aria-label="t('search.modeLabel')">
      <button
        v-for="(item, index) in modes"
        :key="item.value"
        type="button"
        role="radio"
        :aria-checked="mode === item.value"
        :tabindex="mode === item.value ? 0 : -1"
        :class="{ active: mode === item.value }"
        @click="setMode(item.value)"
        @keydown="onModeKeydown($event, index)"
      >{{ item.label }}</button>
    </div>
    <p v-if="warning" class="search-warning" role="status">{{ warning }}</p>
    <section class="answer-panel">
      <button type="button" :disabled="answerLoading || !query.trim()" @click="askAnswer">
        {{ answerLoading ? t('search.answerLoading') : t('search.answerAction') }}
      </button>
      <p v-if="answerError" role="alert">{{ answerError }}</p>
      <p v-if="answer && !answer.grounded" role="status">{{ t('search.answerUngrounded') }}</p>
      <template v-else-if="answer">
        <div class="answer-text markdown-body" v-html="answerHtml" />
        <ol>
          <li v-for="citation in answer.citations" :key="citation.id">
            <router-link :to="{ path: `/page/${encodeURIComponent(citation.pageSlug)}`, query: citation.sectionKey ? { section: citation.sectionKey } : {} }">[{{ citation.id }}] {{ citation.pageTitle }}</router-link>
            <blockquote>{{ citation.quote }}</blockquote>
          </li>
        </ol>
      </template>
    </section>

    <div v-if="results.length > 0" class="filters">
      <div v-if="resultTags.length > 0" class="tag-filter">
        <span class="filter-label">{{ t('search.tagsLabel') }}</span>
        <button
          v-for="tag in resultTags"
          :key="tag"
          :class="['tag-chip', { active: selectedTags.includes(tag) }]"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
        <button v-if="selectedTags.length" class="tag-chip clear" @click="selectedTags = []">{{ t('search.clearTag') }}</button>
      </div>

      <div v-if="mode === 'semantic'" class="score-filter">
        <span class="filter-label">{{ t('search.scoreLabel') }}</span>
        <select v-model.number="minScore" class="score-select">
          <option v-for="o in scoreOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="score-filter">
        <span class="filter-label">{{ t('savedSearches.sort') }}</span>
        <select v-model="sort" class="score-select">
          <option value="RELEVANCE">{{ t('savedSearches.relevance') }}</option>
          <option value="UPDATED">{{ t('savedSearches.updated') }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="search" /></div>
    <div v-else-if="filteredResults.length === 0 && results.length > 0" class="state-placeholder">{{ t('search.noFilteredResults') }}</div>
    <div v-else-if="results.length === 0" class="state-placeholder">{{ t('search.noResults') }}</div>
    <ul v-else class="results">
      <li v-for="(r, index) in filteredResults" :key="r.slug + index" class="result-card" :style="{ animationDelay: `${Math.min(index, 15) * 0.05}s` }">
        <router-link :to="resultLink(r)">
          <div class="card-header">
            <h3>{{ r.title }}</h3>
            <span v-if="r.score !== null" class="score">{{ (r.score * 100).toFixed(0) }}%</span>
          </div>
          <p v-if="r.sectionHeading" class="section-heading">{{ r.sectionHeading }}</p>
          <p class="snippet" v-html="highlightSnippet(r.snippet, query)" />
          <div class="result-sources">
            <span v-for="source in r.sources" :key="source" class="source-badge">
              {{ source === 'text' ? t('search.sourceText') : t('search.sourceSemantic') }}
            </span>
          </div>
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
.saved-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}

.search-modes {
  display: inline-flex;
  padding: 3px;
  margin-bottom: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.search-modes button {
  border: 0;
  border-radius: 6px;
  padding: 6px 12px;
  background: transparent;
  color: var(--color-text-muted);
}

.search-modes button.active {
  background: var(--color-bg);
  color: var(--color-primary);
  box-shadow: var(--shadow);
}

.search-warning {
  margin: 0 0 16px;
  padding: 9px 12px;
  border-left: 3px solid var(--color-warning, #9a6700);
  background: color-mix(in srgb, var(--color-warning, #9a6700) 10%, transparent);
  color: var(--color-text-muted);
  font-size: 13px;
}
.answer-panel{display:grid;gap:10px;margin-bottom:16px;padding:12px;border:1px solid var(--color-border);border-radius:8px}.answer-text{white-space:pre-wrap;line-height:1.6}.answer-panel blockquote{margin:4px 0;color:var(--color-text-muted)}

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

.result-sources {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}

.source-badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-faint);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
