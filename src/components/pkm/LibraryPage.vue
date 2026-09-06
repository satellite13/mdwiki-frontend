<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as library from '@/api/library'
import type { SavedSearch, SavedView } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import CountBadge from '@/components/ui/CountBadge.vue'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

type Item = { page: { id: string; slug: string; title: string }; at: string; count?: number }
const route = useRoute()
const { t, locale } = useI18n()
const items = ref<Item[]>([])
const favoriteSearches = ref<SavedSearch[]>([])
const favoriteViews = ref<SavedView[]>([])
const loading = ref(false)
const error = ref('')
const mode = computed(() => route.name === 'favorites' ? 'favorites' : 'recent')
const isFavorites = computed(() => mode.value === 'favorites')
const showEmpty = computed(() => {
  if (isFavorites.value) {
    return !items.value.length && !favoriteSearches.value.length && !favoriteViews.value.length
  }
  return !items.value.length
})
let controller: AbortController | null = null
let requestId = 0

async function load() {
  controller?.abort()
  controller = new AbortController()
  const id = ++requestId
  const requestedMode = mode.value
  loading.value = true
  error.value = ''
  try {
    if (requestedMode === 'favorites') {
      const [favRes, searchRes, viewRes] = await Promise.all([
        library.getFavorites(controller.signal),
        library.listFavoriteSearches(controller.signal),
        library.listFavoriteViews(controller.signal),
      ])
      if (id === requestId && mode.value === requestedMode) {
        items.value = favRes.data.map((x) => ({ page: x.page, at: x.favoritedAt }))
        favoriteSearches.value = searchRes.data
        favoriteViews.value = viewRes.data
      }
    } else {
      const next = (await library.getRecent(10, controller.signal)).data
        .map((x) => ({ page: x.page, at: x.lastOpenedAt, count: x.openCount }))
      if (id === requestId && mode.value === requestedMode) {
        items.value = next
        favoriteSearches.value = []
        favoriteViews.value = []
      }
    }
  } catch (cause) {
    if (id === requestId && (cause as { code?: string }).code !== 'ERR_CANCELED') {
      error.value = getApiErrorMessage(cause, t('pkm.libraryFailed'))
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

function searchLink(item: SavedSearch) {
  return {
    name: 'search' as const,
    query: {
      saved: item.id,
      q: item.queryText,
      mode: item.mode.toLowerCase(),
    },
  }
}

function viewLink(item: SavedView) {
  return { path: '/views', query: { view: item.id } }
}

function formatWhen(at: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at))
}

watch(mode, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div class="grouped-page">
    <div class="page-header">
      <div>
        <h1>{{ t(`pkm.${mode}`) }}</h1>
        <p class="page-subtitle">{{ t(`pkm.${mode}Subtitle`) }}</p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-secondary" :disabled="loading" @click="load">
          {{ t('brokenLinks.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <div v-else-if="error" class="empty-state" role="alert">
      {{ error }}
      <div class="error-actions">
        <button type="button" class="btn-secondary" @click="load">{{ t('common.retry') }}</button>
      </div>
    </div>
    <div v-else-if="showEmpty" class="empty-state">{{ t('pkm.emptyList') }}</div>
    <div v-else class="groups">
      <section v-if="isFavorites && favoriteSearches.length" class="group-card">
        <div class="group-header">
          <h2 class="group-title">
            {{ t('savedSearches.title') }}
            <CountBadge :value="favoriteSearches.length" />
          </h2>
        </div>
        <ul class="library-list">
          <li v-for="item in favoriteSearches" :key="item.id">
            <div class="library-item-body">
              <router-link :to="searchLink(item)">{{ item.name }}</router-link>
              <small>{{ item.queryText }} · {{ item.mode }}</small>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="isFavorites && favoriteViews.length" class="group-card">
        <div class="group-header">
          <h2 class="group-title">
            {{ t('views.title') }}
            <CountBadge :value="favoriteViews.length" />
          </h2>
        </div>
        <ul class="library-list">
          <li v-for="item in favoriteViews" :key="item.id">
            <div class="library-item-body">
              <router-link :to="viewLink(item)">{{ item.name }}</router-link>
              <small>{{ item.type }}</small>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="items.length" class="group-card">
        <div v-if="isFavorites" class="group-header">
          <h2 class="group-title">
            {{ t('pkm.favoritePages') }}
            <CountBadge :value="items.length" />
          </h2>
        </div>
        <ul class="library-list">
          <li v-for="item in items" :key="item.page.id">
            <div class="library-item-body">
              <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
              <small>
                {{ formatWhen(item.at) }}
                <span v-if="item.count"> · ×{{ item.count }}</span>
              </small>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.error-actions {
  margin-top: 0.75rem;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  background: color-mix(in srgb, var(--color-border, #d0d7de) 18%, transparent);
}

.group-header .group-title {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}
</style>
