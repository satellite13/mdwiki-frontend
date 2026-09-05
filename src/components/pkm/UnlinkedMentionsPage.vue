<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFolderStore } from '@/stores/folders'
import { getPages, invalidatePageIndex } from '@/services/pageIndex'
import * as api from '@/api/linkInsights'
import type { PageListItem, UnlinkedMention } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const folders = useFolderStore()
const { t } = useI18n()
const pages = ref<PageListItem[]>([])
const target = ref('')
const mentions = ref<UnlinkedMention[]>([])
const loading = ref(false)
const error = ref('')
const linking = ref<string | null>(null)
let requestId = 0

onMounted(async () => {
  pages.value = await getPages()
  const query = typeof route.query.target === 'string' ? route.query.target : ''
  target.value = query
})

watch(() => route.query.target, (value) => {
  target.value = typeof value === 'string' ? value : ''
  void load()
}, { immediate: true })

async function select() {
  await router.replace({ query: target.value ? { target: target.value } : {} })
}

async function load() {
  const id = ++requestId
  mentions.value = []
  if (!target.value) return
  loading.value = true
  error.value = ''
  try {
    const data = (await api.getUnlinkedMentions(target.value)).data
    if (id === requestId) mentions.value = data
  } catch (cause) {
    if (id === requestId) error.value = getApiErrorMessage(cause, t('pkm.mentionsFailed'))
  } finally {
    if (id === requestId) loading.value = false
  }
}

async function link(item: UnlinkedMention) {
  if (!auth.isEditor || !confirm(t('pkm.linkConfirm'))) return
  const key = `${item.sourceSlug}:${item.startOffset}`
  linking.value = key
  try {
    await api.linkUnlinkedMention(target.value, item)
    invalidatePageIndex()
    await folders.fetchTree(true)
    await load()
  } catch (cause) {
    error.value = getApiErrorMessage(cause, t('pkm.linkFailed'))
  } finally {
    linking.value = null
  }
}
</script>

<template>
  <main class="pkm-list">
    <h1>{{ t('pkm.unlinked') }}</h1>
    <label>{{ t('pkm.targetPage') }}
      <select v-model="target" @change="select">
        <option value="">{{ t('pkm.choosePage') }}</option>
        <option v-for="page in pages" :key="page.id" :value="page.slug">{{ page.title }}</option>
      </select>
    </label>
    <p v-if="loading">{{ t('common.loading') }}</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="target && !mentions.length">{{ t('pkm.noMentions') }}</p>
    <ul>
      <li v-for="item in mentions" :key="`${item.sourceSlug}:${item.startOffset}`">
        <router-link :to="{ path: `/page/${item.sourceSlug}`, query: item.sectionKey ? { section: item.sectionKey } : {} }">
          {{ item.sourceTitle }}
        </router-link>
        <p>{{ item.snippet }}</p>
        <button v-if="auth.isEditor" :disabled="linking !== null" @click="link(item)">
          {{ linking === `${item.sourceSlug}:${item.startOffset}` ? '…' : t('pkm.createLink') }}
        </button>
      </li>
    </ul>
  </main>
</template>

<style scoped>.pkm-list{max-width:900px;width:100%;margin:auto;padding:24px}.pkm-list label{display:grid;gap:6px}.pkm-list select{min-height:44px}.pkm-list ul{list-style:none;padding:0}.pkm-list li{padding:16px 0;border-bottom:1px solid var(--color-border)}.pkm-list li p{color:var(--color-text-muted)}button{min-height:44px}</style>
