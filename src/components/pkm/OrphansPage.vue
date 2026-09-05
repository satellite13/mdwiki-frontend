<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/linkInsights'
import type { OrphanDefinition, OrphanPage } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import DiscoveryNav from './DiscoveryNav.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const definitions: OrphanDefinition[] = ['NO_INCOMING', 'NO_LINKS', 'NO_OUTGOING']
const definition = ref<OrphanDefinition>('NO_INCOMING')
const items = ref<OrphanPage[]>([])
const loading = ref(false)
const error = ref('')
let requestId = 0

watch(() => route.query.definition, async (raw) => {
  definition.value = definitions.includes(raw as OrphanDefinition) ? raw as OrphanDefinition : 'NO_INCOMING'
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = (await api.getOrphans(definition.value)).data
    if (id === requestId) items.value = data
  } catch (cause) {
    if (id === requestId) error.value = getApiErrorMessage(cause, t('pkm.orphansFailed'))
  } finally {
    if (id === requestId) loading.value = false
  }
}, { immediate: true })

function change() {
  void router.replace({ query: { definition: definition.value } })
}
</script>

<template>
  <main class="pkm-list">
    <DiscoveryNav />
    <h1>{{ t('pkm.orphans') }}</h1>
    <label>{{ t('pkm.definition') }}
      <select v-model="definition" @change="change">
        <option v-for="value in definitions" :key="value" :value="value">{{ t(`pkm.${value}`) }}</option>
      </select>
    </label>
    <p v-if="loading">{{ t('common.loading') }}</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!items.length">{{ t('pkm.noOrphans') }}</p>
    <ul v-else>
      <li v-for="item in items" :key="item.page.id">
        <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
        <small>{{ t('pkm.linkCounts', { incoming: item.incomingCount, outgoing: item.outgoingCount }) }}</small>
      </li>
    </ul>
  </main>
</template>

<style scoped>.pkm-list{max-width:800px;width:100%;margin:auto;padding:24px}.pkm-list label{display:grid;gap:6px}.pkm-list select{min-height:44px}.pkm-list ul{list-style:none;padding:0}.pkm-list li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--color-border)}small{color:var(--color-text-muted)}</style>
