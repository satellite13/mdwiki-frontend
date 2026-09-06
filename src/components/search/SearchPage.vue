<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as searchApi from '@/api/search'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { escapeHtml } from '@/utils/htmlEscape'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  normalizeSearchResults,
  type NormalizedSearchResult
} from './normalizeSearchResults'
import type { AnswerResponse } from '@/types'
import type { SavedSearch, SavedSearchMode, SavedSearchSort } from '@/types'
import * as savedSearchApi from '@/api/savedSearches'
import { isSavedSearchModified, normalizeSearchDefinition, savedSearchQuery } from './savedSearchState'

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
const modes = computed(() => [
  { value: 'hybrid' as const, label: t('search.modeHybrid') },
  { value: 'text' as const, label: t('search.modeText') },
  { value: 'semantic' as const, label: t('search.modeSemantic') }
])

const scoreOptions = computed(() => [
  { label: t('search.allScores'), value: '0' },
  { label: '50%+', value: '0.5' },
  { label: '75%+', value: '0.75' },
  { label: '90%+', value: '0.9' },
])

const sortOptions = computed(() => [
  { value: 'RELEVANCE', label: t('savedSearches.relevance') },
  { value: 'UPDATED', label: t('savedSearches.updated') },
])

function setMinScore(value: string | string[] | null) {
  minScore.value = value == null || Array.isArray(value) ? 0 : Number(value)
}

function setSort(value: string | string[] | null) {
  sort.value = value === 'UPDATED' ? 'UPDATED' : 'RELEVANCE'
}

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
  void doSearch()
}

function clearTags() {
  if (selectedTags.value.length === 0) return
  selectedTags.value = []
  void doSearch()
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
      const { data } = selectedTags.value.length
        ? await searchApi.searchPages(query.value, selectedTags.value)
        : await searchApi.searchPages(query.value)
      if (!isCurrent()) return
      results.value = normalizeSearchResults(data, [])
    } else if (searchMode === 'semantic') {
      const { data } = selectedTags.value.length
        ? await searchApi.searchPagesRag(query.value, undefined, selectedTags.value)
        : await searchApi.searchPagesRag(query.value)
      if (!isCurrent()) return
      results.value = normalizeSearchResults([], data)
    } else {
      const [text, semantic] = await Promise.allSettled([
        selectedTags.value.length
          ? searchApi.searchPages(query.value, selectedTags.value)
          : searchApi.searchPages(query.value),
        selectedTags.value.length
          ? searchApi.searchPagesRag(query.value, undefined, selectedTags.value)
          : searchApi.searchPagesRag(query.value)
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
  <div class="grouped-page search-page">
    <div class="page-header">
      <div>
        <div class="title-row">
          <h1>
            {{ t('search.title') }}
            <HelpTip :label="t('search.title')">
              <p>{{ t('search.subtitle') }}</p>
            </HelpTip>
          </h1>
        </div>
        <p v-if="query" class="page-subtitle">{{ t('search.resultsFor', { query }) }}</p>
      </div>
      <router-link class="btn-secondary" to="/saved-searches">
        {{ t('savedSearches.title') }}
      </router-link>
    </div>

    <section class="group-card search-controls">
      <div class="controls-row">
        <div class="mode-row">
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
          <HelpTip :label="t('search.modeHelpLabel')">
            <p><strong>{{ t('search.modeHybrid') }}.</strong> {{ t('search.modeHybridHelp') }}</p>
            <p><strong>{{ t('search.modeText') }}.</strong> {{ t('search.modeTextHelp') }}</p>
            <p><strong>{{ t('search.modeSemantic') }}.</strong> {{ t('search.modeSemanticHelp') }}</p>
            <p>{{ t('search.modeHelpTip') }}</p>
          </HelpTip>
        </div>
        <nav class="saved-actions" :aria-label="t('savedSearches.actions')">
          <span v-if="activeSaved" class="saved-name">
            {{ activeSaved.name }}
            <span v-if="savedModified"> · {{ t('savedSearches.modified') }}</span>
          </span>
          <button
            v-if="activeSaved && savedModified"
            type="button"
            class="btn-secondary"
            @click="updateSaved"
          >{{ t('savedSearches.update') }}</button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="savedLoading || !query.trim()"
            @click="saveAsNew"
          >{{ activeSaved ? t('savedSearches.saveAsNew') : t('savedSearches.saveSearch') }}</button>
          <button
            v-if="activeSaved"
            type="button"
            class="btn-danger"
            @click="deleteSaved"
          >{{ t('common.delete') }}</button>
        </nav>
      </div>
      <p v-if="warning" class="search-warning" role="status">{{ warning }}</p>
    </section>

    <section class="group-card answer-panel">
      <div class="answer-toolbar">
        <div class="answer-intro">
          <button
            type="button"
            class="btn-primary"
            :disabled="answerLoading || !query.trim()"
            @click="askAnswer"
          >
            {{ answerLoading ? t('search.answerLoading') : t('search.answerAction') }}
          </button>
          <p class="answer-hint">{{ t('search.answerHint') }}</p>
        </div>
      </div>
      <p v-if="answerError" class="answer-error" role="alert">{{ answerError }}</p>
      <p v-if="answer && !answer.grounded" class="answer-status" role="status">{{ t('search.answerUngrounded') }}</p>
      <ol v-else-if="answer" class="answer-citations">
        <li v-for="citation in answer.citations" :key="citation.id">
          <div class="citation-head">
            <router-link
              :to="{
                path: `/page/${encodeURIComponent(citation.pageSlug)}`,
                query: citation.sectionKey ? { section: citation.sectionKey } : {}
              }"
            >[{{ citation.id }}] {{ citation.pageTitle }}</router-link>
            <span v-if="citation.sectionHeading" class="citation-section">{{ citation.sectionHeading }}</span>
          </div>
          <blockquote>{{ citation.quote }}</blockquote>
        </li>
      </ol>
    </section>

    <section v-if="results.length > 0" class="group-card filters">
      <div v-if="resultTags.length > 0" class="tag-filter">
        <span class="filter-label">{{ t('search.tagsLabel') }}</span>
        <button
          v-for="tag in resultTags"
          :key="tag"
          type="button"
          :class="['tag-chip', { active: selectedTags.includes(tag) }]"
          @click="toggleTag(tag)"
        >{{ tag }}</button>
        <button
          v-if="selectedTags.length"
          type="button"
          class="tag-chip clear"
          @click="clearTags"
        >{{ t('search.clearTag') }}</button>
      </div>

      <div class="filter-selects">
        <label v-if="mode === 'semantic'" class="score-filter">
          <span class="filter-label">{{ t('search.scoreLabel') }}</span>
          <AppSelect
            class="score-select"
            :model-value="String(minScore)"
            :options="scoreOptions"
            :aria-label="t('search.scoreLabel')"
            @update:model-value="setMinScore"
          />
        </label>
        <label class="score-filter">
          <span class="filter-label">{{ t('savedSearches.sort') }}</span>
          <AppSelect
            class="score-select"
            :model-value="sort"
            :options="sortOptions"
            :aria-label="t('savedSearches.sort')"
            @update:model-value="setSort"
          />
        </label>
      </div>
    </section>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="search" /></div>
    <div v-else-if="filteredResults.length === 0 && results.length > 0" class="empty-state">
      {{ t('search.noFilteredResults') }}
    </div>
    <div v-else-if="results.length === 0" class="empty-state">{{ t('search.noResults') }}</div>
    <section v-else class="group-card">
      <ul class="results">
        <li
          v-for="(r, index) in filteredResults"
          :key="r.slug + index"
          class="result-card"
        >
          <router-link :to="resultLink(r)">
            <div class="card-header">
              <h3>{{ r.title }}</h3>
              <span v-if="r.score !== null" class="score">{{ (r.score * 100).toFixed(0) }}%</span>
            </div>
            <p v-if="r.sectionHeading" class="section-heading">{{ r.sectionHeading }}</p>
            <p class="snippet" v-html="highlightSnippet(r.snippet, query)" />
            <div class="result-meta">
              <span v-for="source in r.sources" :key="source" class="source-badge">
                {{ source === 'text' ? t('search.sourceText') : t('search.sourceSemantic') }}
              </span>
              <span v-for="tag in r.tags" :key="tag" class="result-tag">{{ tag }}</span>
            </div>
          </router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.search-controls,
.answer-panel,
.filters {
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
}

.controls-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1rem;
  align-items: center;
  justify-content: space-between;
}

.mode-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.mode-row > :deep(.help-tip) {
  font-size: 0.875rem;
}

.search-modes {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.search-modes button {
  border: 0;
  border-radius: 6px;
  min-height: 36px;
  padding: 6px 12px;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  cursor: pointer;
}

.search-modes button.active {
  background: var(--color-bg);
  color: var(--color-primary);
  box-shadow: var(--shadow);
}

.saved-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.saved-name {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-right: 0.25rem;
}

.search-warning,
.answer-error,
.answer-status {
  margin: 0.85rem 0 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

.search-warning,
.answer-status {
  border-left: 3px solid var(--color-warning, #d97706);
  background: color-mix(in srgb, var(--color-warning, #d97706) 10%, transparent);
  color: var(--color-text-muted);
}

.answer-error {
  border-left: 3px solid var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 8%, transparent);
  color: var(--color-danger);
}

.answer-panel {
  min-width: 0;
  overflow: hidden;
}

.answer-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.answer-intro {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  flex: 1;
}

.answer-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.answer-citations {
  margin: 0.85rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.answer-citations > li {
  min-width: 0;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
}

.citation-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  min-width: 0;
}

.citation-head a {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.citation-section {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.answer-citations blockquote {
  margin: 0.5rem 0 0;
  padding: 0;
  border: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  max-width: 100%;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem 1.25rem;
}

.filter-label {
  font-size: 0.8rem;
  font-weight: 650;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.tag-filter,
.filter-selects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
}

.filter-selects {
  margin-left: auto;
}

.score-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.tag-chip {
  font-size: 0.75rem;
  min-height: 28px;
  padding: 0.15rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
}

.tag-chip:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  color: var(--color-primary);
}

.tag-chip.active {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  color: var(--color-primary);
}

.tag-chip.clear {
  border-color: transparent;
  font-style: italic;
}

.score-select {
  min-width: 9rem;
}

:deep(.search-highlight) {
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  color: var(--color-text);
  border-radius: 3px;
  padding: 0 2px;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
}

.result-card {
  border-bottom: 1px solid var(--color-border);
}

.result-card:last-child {
  border-bottom: 0;
}

.result-card a {
  display: block;
  min-height: 44px;
  padding: 0.95rem 1.1rem;
  text-decoration: none;
  color: inherit;
}

.result-card a:hover {
  background: var(--color-bg-hover);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-wikilink);
}

.score {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--color-text-faint);
  font-variant-numeric: tabular-nums;
}

.section-heading {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.snippet {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.source-badge,
.result-tag {
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: var(--color-text-faint);
  background: var(--color-bg-secondary);
}

.result-tag {
  border: 1px solid var(--color-border);
  background: transparent;
}

@media (max-width: 767px) {
  .controls-row,
  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-selects {
    margin-left: 0;
  }

  .search-modes {
    width: 100%;
  }

  .search-modes button {
    flex: 1;
  }
}
</style>
