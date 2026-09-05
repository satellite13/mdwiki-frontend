<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as library from '@/api/library'
import { getApiErrorMessage } from '@/utils/apiError'

type Item = { page: { id: string; slug: string; title: string }; at: string; count?: number }
const route = useRoute()
const { t, locale } = useI18n()
const items = ref<Item[]>([])
const loading = ref(false)
const error = ref('')
const mode = computed(() => route.name === 'favorites' ? 'favorites' : 'recent')
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
    let next: Item[]
    if (requestedMode === 'favorites') {
      next = (await library.getFavorites(controller.signal)).data
        .map((x) => ({ page: x.page, at: x.favoritedAt }))
    } else {
      next = (await library.getRecent(50, controller.signal)).data
        .map((x) => ({ page: x.page, at: x.lastOpenedAt, count: x.openCount }))
    }
    if (id === requestId && mode.value === requestedMode) items.value = next
  } catch (cause) {
    if (id === requestId && (cause as { code?: string }).code !== 'ERR_CANCELED') {
      error.value = getApiErrorMessage(cause, t('pkm.libraryFailed'))
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch(mode, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <main class="pkm-list">
    <h1>{{ t(`pkm.${mode}`) }}</h1>
    <p v-if="loading" aria-live="polite">{{ t('common.loading') }}</p>
    <div v-else-if="error" role="alert">{{ error }} <button @click="load">{{ t('common.retry') }}</button></div>
    <p v-else-if="!items.length">{{ t('pkm.emptyList') }}</p>
    <ul v-else>
      <li v-for="item in items" :key="item.page.id">
        <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
        <small>{{ new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at)) }}
          <span v-if="item.count"> · ×{{ item.count }}</span>
        </small>
      </li>
    </ul>
  </main>
</template>

<style scoped>.pkm-list{max-width:800px;width:100%;margin:auto;padding:24px}.pkm-list ul{list-style:none;padding:0}.pkm-list li{display:flex;justify-content:space-between;gap:16px;align-items:center;min-height:52px;border-bottom:1px solid var(--color-border)}small{color:var(--color-text-muted);text-align:right}@media(max-width:600px){.pkm-list li{align-items:flex-start;flex-direction:column;padding:12px 0}small{text-align:left}}</style>
