<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as viewsApi from '@/api/views'
import * as propertiesApi from '@/api/properties'
import * as libraryApi from '@/api/library'
import { useI18n } from 'vue-i18n'
import type {
  PropertyDefinition,
  SavedView,
  SavedViewWritePayload,
  ViewFilterMode,
  ViewRunItem,
} from '@/types'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  buildViewFilters,
  createEmptyViewFilterDraft,
  defaultOperatorForType,
  draftsFromSavedFilters,
  formatViewFilterSummary,
  operatorsForPropertyType,
  selectOptionsFromConfig,
  type ViewFilterDraft,
  type ViewFilterOp,
} from '@/utils/viewFilters'
import { getApiErrorMessage, isApiErrorWithStatus } from '@/utils/apiError'
import { useDialogStore } from '@/stores/dialog'

const MAX_FILTERS = 20
const { t } = useI18n()
const route = useRoute()
const dialog = useDialogStore()
const views = ref<SavedView[]>([])
const definitions = ref<PropertyDefinition[]>([])
const items = ref<ViewRunItem[]>([])
const name = ref('')
const sortKey = ref('')
const groupKey = ref('')
const type = ref<SavedView['type']>('TABLE')
const activeType = ref<SavedView['type']>('TABLE')
const filterDrafts = ref<ViewFilterDraft[]>([createEmptyViewFilterDraft()])
const filterMode = ref<ViewFilterMode>('ALL')
const editingViewId = ref<string | null>(null)
const editingVersion = ref<number | null>(null)
const error = ref('')
const loading = ref(false)
const nextCursor = ref<string | null>(null)
const activeView = ref<SavedView | null>(null)
const favoriteBusyId = ref<string | null>(null)

const typeByKey = computed(() =>
  Object.fromEntries(definitions.value.map((d) => [d.key, d.type])) as Record<string, PropertyDefinition['type']>
)
const layoutOptions = computed(() => [
  { value: 'TABLE', label: t('views.table') },
  { value: 'LIST', label: t('views.list') },
  { value: 'CARDS', label: t('views.cards') },
])
const definitionOptions = computed(() => [
  { value: '', label: t('views.none') },
  ...definitions.value.map((definition) => ({
    value: definition.key,
    label: definition.displayName,
  })),
])
const booleanValueOptions = computed(() => [
  { value: '', label: t('views.chooseValue') },
  { value: 'true', label: t('views.boolTrue') },
  { value: 'false', label: t('views.boolFalse') },
])

function definitionFor(draft: ViewFilterDraft) {
  return definitions.value.find((definition) => definition.key === draft.key) ?? null
}

function operatorOptionsFor(draft: ViewFilterDraft) {
  const definition = definitionFor(draft)
  return definition
    ? operatorsForPropertyType(definition.type).map((op) => ({ value: op, label: t(`views.op${op}`) }))
    : []
}

function selectValueOptionsFor(draft: ViewFilterDraft) {
  const definition = definitionFor(draft)
  const values = definition ? selectOptionsFromConfig(definition.config) : []
  return [
    { value: '', label: t('views.chooseValue') },
    ...values.map((value) => ({ value, label: value })),
  ]
}

function setFilterKey(index: number, value: string | string[] | null) {
  const draft = filterDrafts.value[index]
  if (!draft) return
  const key = typeof value === 'string' ? value : ''
  const definition = definitions.value.find((item) => item.key === key)
  draft.key = key
  draft.op = definition ? defaultOperatorForType(definition.type) : 'EQ'
  draft.value = ''
}

function setFilterOp(index: number, value: string | string[] | null) {
  const draft = filterDrafts.value[index]
  if (!draft) return
  const op = (typeof value === 'string' ? value : 'EQ') as ViewFilterOp
  draft.op = op
  if (op === 'EXISTS') draft.value = ''
}

function addFilter() {
  if (filterDrafts.value.length < MAX_FILTERS) {
    filterDrafts.value.push(createEmptyViewFilterDraft())
  }
}

function removeFilter(index: number) {
  if (filterDrafts.value.length <= 1) return
  filterDrafts.value.splice(index, 1)
  if (filterDrafts.value.length < 2) filterMode.value = 'ALL'
}

async function load() {
  try {
    ;[views.value, definitions.value] = await Promise.all([
      viewsApi.listViews().then(r => r.data),
      propertiesApi.listPropertyDefinitions().then(r => r.data),
    ])
  } catch {
    error.value = t('views.loadFailed')
  }
}

function resetForm() {
  name.value = ''
  type.value = 'TABLE'
  sortKey.value = ''
  groupKey.value = ''
  filterDrafts.value = [createEmptyViewFilterDraft()]
  filterMode.value = 'ALL'
  editingViewId.value = null
  editingVersion.value = null
}

function startEditing(view: SavedView) {
  name.value = view.name
  type.value = view.type
  filterDrafts.value = draftsFromSavedFilters(view.filters, typeByKey.value)
  filterMode.value = view.filterMode ?? 'ALL'
  sortKey.value = view.sort[0]?.key ?? ''
  groupKey.value = view.grouping?.key ?? ''
  editingViewId.value = view.id
  editingVersion.value = view.version
  error.value = ''
}

function buildPayload(): SavedViewWritePayload {
  return {
    name: name.value.trim(),
    type: type.value,
    filterMode: filterMode.value,
    filters: buildViewFilters(filterDrafts.value, typeByKey.value),
    sort: sortKey.value ? [{ key: sortKey.value, direction: 'ASC' }] : [],
    grouping: groupKey.value ? { key: groupKey.value } : null,
    layout: {},
  }
}

async function submit() {
  if (!name.value.trim()) return
  error.value = ''
  try {
    const payload = buildPayload()
    if (editingViewId.value) {
      await viewsApi.updateView(editingViewId.value, {
        ...payload,
        expectedVersion: editingVersion.value ?? undefined,
      })
    } else {
      await viewsApi.createView(payload)
    }
    resetForm()
    await load()
  } catch (cause) {
    if (cause instanceof Error && (
      cause.message === 'value-required'
      || cause.message.startsWith('invalid-')
      || cause.message.startsWith('unknown-property')
    )) {
      error.value = t('views.filterInvalid')
      return
    }
    if (editingViewId.value && isApiErrorWithStatus(cause, 409)) {
      try {
        const latest = (await viewsApi.getView(editingViewId.value)).data
        editingVersion.value = latest.version
        views.value = views.value.map((view) => view.id === latest.id ? latest : view)
      } catch {
        // Keep the draft even if refreshing the optimistic-lock version fails.
      }
      error.value = t('views.updateConflict')
      return
    }
    error.value = getApiErrorMessage(
      cause,
      t(editingViewId.value ? 'views.updateFailed' : 'views.createFailed'),
    )
  }
}

async function run(view: SavedView) {
  if (loading.value) return
  loading.value = true
  activeType.value = view.type
  activeView.value = view
  nextCursor.value = null
  error.value = ''
  try {
    const result = (await viewsApi.runView(view.id)).data
    items.value = result.items ?? []
    nextCursor.value = result.nextCursor ?? null
  } catch {
    error.value = t('views.runFailed')
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || !nextCursor.value || !activeView.value) return
  loading.value = true
  error.value = ''
  try {
    const result = (await viewsApi.runView(activeView.value.id, nextCursor.value)).data
    items.value = [...items.value, ...(result.items ?? [])]
    nextCursor.value = result.nextCursor ?? null
  } catch {
    error.value = t('views.runFailed')
  } finally {
    loading.value = false
  }
}

async function remove(view: SavedView) {
  await viewsApi.deleteView(view.id)
  if (editingViewId.value === view.id) resetForm()
  if (activeView.value?.id === view.id) {
    activeView.value = null
    items.value = []
    nextCursor.value = null
  }
  await load()
}

async function toggleFavorite(view: SavedView) {
  if (favoriteBusyId.value === view.id) return
  const previous = view.favorited
  view.favorited = !previous
  favoriteBusyId.value = view.id
  try {
    if (view.favorited) await libraryApi.addFavoriteView(view.id)
    else await libraryApi.removeFavoriteView(view.id)
  } catch (e) {
    view.favorited = previous
    await dialog.alert(getApiErrorMessage(e, t('pkm.favoriteFailed')))
  } finally {
    if (favoriteBusyId.value === view.id) favoriteBusyId.value = null
  }
}

function filterSummary(view: SavedView): string {
  return formatViewFilterSummary(view.filters, view.filterMode ?? 'ALL', {
    noFilter: t('views.noFilter'),
    allConnector: t('views.allConnector'),
    anyConnector: t('views.anyConnector'),
    property: (key) => definitions.value.find((definition) => definition.key === key)?.displayName ?? key,
    operator: (op) => t(`views.op${op}`),
  })
}

watch(
  () => [route.query.view, views.value.map((v) => v.id).join('\0')] as const,
  ([id]) => {
    if (typeof id !== 'string' || !id) return
    if (activeView.value?.id === id) return
    const v = views.value.find((x) => x.id === id)
    if (v) void run(v)
  },
  { immediate: true },
)

onMounted(load)
</script>

<template>
  <div class="grouped-page views-page">
    <div class="page-header">
      <div>
        <div class="title-row">
          <h1>
            {{ t('views.title') }}
            <HelpTip :label="t('views.helpLabel')">
              <p>{{ t('views.subtitle') }}</p>
              <p>{{ t('views.helpIntro') }}</p>
              <p>{{ t('views.helpStep1') }}</p>
              <p>{{ t('views.helpStep2') }}</p>
              <p>{{ t('views.helpStep3') }}</p>
              <p>{{ t('views.helpLimit') }}</p>
            </HelpTip>
          </h1>
        </div>
      </div>
    </div>

    <p v-if="error" class="empty-state" role="alert">{{ error }}</p>

    <section class="group-card create-card">
      <h2>{{ editingViewId ? t('views.editTitle') : t('views.createTitle') }}</h2>
      <form class="create-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">{{ t('views.name') }}</span>
          <input v-model="name" data-testid="view-name" required maxlength="120">
        </label>
        <label class="field">
          <span class="field-label">{{ t('views.layout') }}</span>
          <AppSelect v-model="type" :options="layoutOptions" />
        </label>

        <fieldset class="filter-fieldset">
          <legend class="field-label">{{ t('views.filter') }}</legend>
          <div
            v-for="(draft, index) in filterDrafts"
            :key="index"
            class="filter-row"
            :data-testid="`filter-row-${index}`"
          >
            <label class="field">
              <span class="field-label">{{ t('views.filterProperty') }}</span>
              <AppSelect
                :model-value="draft.key"
                :options="definitionOptions"
                searchable
                :placeholder="t('views.none')"
                @update:model-value="setFilterKey(index, $event)"
              />
            </label>
            <label class="field">
              <span class="field-label">{{ t('views.filterOp') }}</span>
              <AppSelect
                :model-value="draft.op"
                :options="operatorOptionsFor(draft)"
                :disabled="!draft.key"
                @update:model-value="setFilterOp(index, $event)"
              />
            </label>
            <label v-if="draft.op !== 'EXISTS'" class="field">
              <span class="field-label">{{ t('views.filterValue') }}</span>
              <AppSelect
                v-if="definitionFor(draft)?.type === 'BOOLEAN'"
                v-model="draft.value"
                :options="booleanValueOptions"
                :disabled="!draft.key"
                :placeholder="t('views.chooseValue')"
              />
              <AppSelect
                v-else-if="selectValueOptionsFor(draft).length > 1"
                v-model="draft.value"
                :options="selectValueOptionsFor(draft)"
                :disabled="!draft.key"
                :placeholder="t('views.chooseValue')"
              />
              <input
                v-else
                v-model="draft.value"
                :disabled="!draft.key"
                :type="definitionFor(draft)?.type === 'NUMBER' ? 'number' : definitionFor(draft)?.type === 'DATE' ? 'date' : 'text'"
                :placeholder="t('views.filterValueHint')"
              >
            </label>
            <button
              v-if="filterDrafts.length > 1"
              type="button"
              class="btn-secondary remove-filter"
              :data-testid="`remove-filter-${index}`"
              :aria-label="t('views.removeConditionNumber', { number: index + 1 })"
              @click="removeFilter(index)"
            >{{ t('views.removeCondition') }}</button>
          </div>
          <div class="filter-controls">
            <button
              type="button"
              class="btn-secondary"
              data-testid="add-filter"
              :disabled="filterDrafts.length >= MAX_FILTERS"
              @click="addFilter"
            >{{ t('views.addCondition') }}</button>
            <div v-if="filterDrafts.length >= 2" class="filter-mode" role="group" :aria-label="t('views.filterMode')">
              <label>
                <input v-model="filterMode" data-testid="filter-mode-all" type="radio" value="ALL">
                {{ t('views.filterModeAll') }}
              </label>
              <label>
                <input v-model="filterMode" data-testid="filter-mode-any" type="radio" value="ANY">
                {{ t('views.filterModeAny') }}
              </label>
            </div>
            <span v-if="filterDrafts.length >= MAX_FILTERS" class="filter-limit">
              {{ t('views.filterLimit', { count: MAX_FILTERS }) }}
            </span>
          </div>
          <p class="filter-hint">{{ t('views.filterOptionalHint') }}</p>
        </fieldset>

        <label class="field">
          <span class="field-label">{{ t('views.sort') }}</span>
          <AppSelect
            v-model="sortKey"
            :options="definitionOptions"
            searchable
            :placeholder="t('views.none')"
          />
        </label>
        <label class="field">
          <span class="field-label">{{ t('views.group') }}</span>
          <AppSelect
            v-model="groupKey"
            :options="definitionOptions"
            searchable
            :placeholder="t('views.none')"
          />
        </label>
        <div class="form-actions">
          <button
            v-if="editingViewId"
            type="button"
            class="btn-secondary"
            data-testid="cancel-edit"
            @click="resetForm"
          >{{ t('views.cancel') }}</button>
          <button type="submit" class="btn-primary">
            {{ editingViewId ? t('views.save') : t('views.create') }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="views.length" class="group-card">
      <ul class="library-list" :aria-label="t('views.title')">
        <li v-for="view in views" :key="view.id">
          <div class="library-item-body">
            <button type="button" class="link-btn" @click="run(view)">{{ view.name }}</button>
            <small>{{ filterSummary(view) }} · {{ view.type }}</small>
          </div>
          <div class="view-actions">
            <button
              type="button"
              class="btn-secondary"
              :data-testid="`edit-view-${view.id}`"
              @click="startEditing(view)"
            >{{ t('views.edit') }}</button>
            <button
              type="button"
              class="favorite-btn"
              :class="{ active: view.favorited }"
              :aria-label="view.favorited ? t('pkm.removeFavorite') : t('pkm.addFavorite')"
              :aria-pressed="view.favorited"
              :aria-busy="favoriteBusyId === view.id"
              :disabled="favoriteBusyId === view.id"
              @click="toggleFavorite(view)"
            >
              <span class="material-symbols-outlined notranslate" translate="no">{{ view.favorited ? 'star' : 'star_outline' }}</span>
            </button>
            <button
              type="button"
              class="btn-secondary"
              :aria-label="t('views.deleteNamed', { name: view.name })"
              @click="remove(view)"
            >{{ t('views.delete') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <p v-if="loading" class="state-placeholder" role="status">{{ t('views.loading') }}</p>
    <p v-else-if="activeView && !items.length" class="empty-state">{{ t('views.empty') }}</p>

    <section v-else-if="activeType === 'TABLE' && items.length" class="group-card">
      <div class="table-scroll">
        <table class="data-table">
          <caption class="sr-only">{{ t('views.results') }}</caption>
          <thead>
            <tr>
              <th>{{ t('views.titleColumn') }}</th>
              <th>{{ t('views.group') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.page.id">
              <td>
                <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
              </td>
              <td>{{ item.groupKey ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="activeType === 'LIST' && items.length" class="group-card">
      <ul class="library-list" :aria-label="t('views.results')">
        <li v-for="item in items" :key="item.page.id">
          <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
          <small v-if="item.groupKey">{{ item.groupKey }}</small>
        </li>
      </ul>
    </section>

    <section v-else-if="activeType === 'CARDS' && items.length" class="cards" :aria-label="t('views.results')">
      <article v-for="item in items" :key="item.page.id" class="group-card card-item">
        <h2>
          <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
        </h2>
        <p v-if="item.groupKey" class="muted">{{ item.groupKey }}</p>
      </article>
    </section>

    <button
      v-if="nextCursor"
      type="button"
      class="btn-secondary load-more"
      :aria-label="t('views.loadMoreAria')"
      :disabled="loading"
      @click="loadMore"
    >{{ t('views.loadMore') }}</button>
  </div>
</template>

<style scoped>
.create-card {
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
}

.create-card h2 {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}

.create-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
  align-items: end;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted, #656d76);
}

.field input,
.field :deep(.app-select) {
  width: 100%;
  min-width: 0;
}

.field input {
  min-height: 40px;
}

.filter-fieldset {
  grid-column: 1 / -1;
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
  min-width: 0;
}

.filter-fieldset legend {
  padding: 0 0.25rem;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 0.75rem 1rem;
  align-items: end;
}

.filter-row + .filter-row {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #d0d7de);
}

.remove-filter {
  min-height: 40px;
}

.filter-controls,
.filter-mode {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-controls {
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.filter-mode label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.filter-limit {
  color: var(--color-text-muted, #656d76);
  font-size: 0.85rem;
}

.filter-hint {
  margin: 0.65rem 0 0;
  color: var(--color-text-muted, #656d76);
  font-size: 0.85rem;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.muted {
  color: var(--color-text-muted, #656d76);
  font-size: 0.85rem;
}

.table-scroll {
  overflow-x: auto;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.85rem;
}

.card-item {
  padding: 1rem 1.1rem;
}

.card-item h2 {
  margin: 0;
  font-size: 1rem;
}

.card-item p {
  margin: 0.4rem 0 0;
}

.load-more {
  margin-top: 1rem;
}

.view-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.favorite-btn.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.favorite-btn:disabled {
  opacity: 0.6;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 767px) {
  .create-form,
  .filter-row {
    grid-template-columns: 1fr;
  }

  .form-actions {
    justify-content: stretch;
  }

  .form-actions .btn-primary {
    width: 100%;
  }
}
</style>
