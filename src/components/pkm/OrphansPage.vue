<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/linkInsights'
import type { OrphanDefinition, OrphanPage } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import DiscoveryNav from './DiscoveryNav.vue'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const definitions: OrphanDefinition[] = ['NO_INCOMING', 'NO_LINKS', 'NO_OUTGOING']
const definition = ref<OrphanDefinition>('NO_INCOMING')
const definitionOptions = computed(() =>
  definitions.map((value) => ({ value, label: t(`pkm.${value}`) }))
)
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

function changeDefinition(value: string | string[] | null) {
  const next = typeof value === 'string' && definitions.includes(value as OrphanDefinition)
    ? value as OrphanDefinition
    : 'NO_INCOMING'
  definition.value = next
  void router.replace({ query: { definition: next } })
}
</script>

<template>
  <div class="grouped-page">
    <div class="page-header">
      <div>
        <div class="title-row">
          <h1>
            {{ t('pkm.discovery') }}
            <HelpTip :label="t('pkm.discovery')">
              <p>{{ t('pkm.orphansSubtitle') }}</p>
            </HelpTip>
          </h1>
        </div>
      </div>
      <DiscoveryNav />
    </div>

    <section class="group-card discovery-toolbar">
      <label class="toolbar-field">
        <span class="field-label">{{ t('pkm.definition') }}</span>
        <AppSelect
          :model-value="definition"
          :options="definitionOptions"
          :aria-label="t('pkm.definition')"
          @update:model-value="changeDefinition"
        />
      </label>
    </section>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <div v-else-if="error" class="empty-state" role="alert">{{ error }}</div>
    <div v-else-if="!items.length" class="empty-state">{{ t('pkm.noOrphans') }}</div>
    <section v-else class="group-card">
      <ul class="library-list">
        <li v-for="item in items" :key="item.page.id">
          <router-link :to="`/page/${item.page.slug}`">{{ item.page.title }}</router-link>
          <small>{{ t('pkm.linkCounts', { incoming: item.incomingCount, outgoing: item.outgoingCount }) }}</small>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.toolbar-field :deep(.app-select) {
  display: block;
  width: 100%;
  min-width: 0;
}
</style>
