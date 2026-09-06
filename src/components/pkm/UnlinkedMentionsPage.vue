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
import { useDialogStore } from '@/stores/dialog'
import DiscoveryNav from './DiscoveryNav.vue'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import HelpTip from '@/components/ui/HelpTip.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const folders = useFolderStore()
const dialog = useDialogStore()
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
  if (!auth.isEditor) return
  if (!await dialog.confirm(t('pkm.linkConfirm'), { confirmLabel: t('pkm.createLink') })) return
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
  <div class="grouped-page">
    <div class="page-header">
      <div>
        <h1>{{ t('pkm.discovery') }}</h1>
        <p class="page-subtitle">{{ t('pkm.unlinkedSubtitle') }}</p>
      </div>
      <DiscoveryNav />
    </div>

    <section class="group-card discovery-toolbar">
      <label class="toolbar-field">
        <span class="field-label-row">
          <span class="field-label">{{ t('pkm.targetPage') }}</span>
          <HelpTip :label="t('pkm.targetPageHelpLabel')">
            <p>{{ t('pkm.targetPageHelp') }}</p>
          </HelpTip>
        </span>
        <AppSelect
          v-model="target"
          :options="[
            { value: '', label: t('pkm.choosePage') },
            ...pages.map((p) => ({ value: p.slug, label: p.title })),
          ]"
          searchable
          :placeholder="t('pkm.choosePage')"
          @change="select"
        />
      </label>
    </section>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <div v-else-if="error" class="empty-state" role="alert">{{ error }}</div>
    <div v-else-if="!target" class="empty-state">{{ t('pkm.chooseTargetHint') }}</div>
    <div v-else-if="!mentions.length" class="empty-state">{{ t('pkm.noMentions') }}</div>
    <section v-else class="group-card">
      <ul class="library-list">
        <li v-for="item in mentions" :key="`${item.sourceSlug}:${item.startOffset}`">
          <div class="library-item-body">
            <router-link :to="{ path: `/page/${item.sourceSlug}`, query: item.sectionKey ? { section: item.sectionKey } : {} }">
              {{ item.sourceTitle }}
            </router-link>
            <p>{{ item.snippet }}</p>
          </div>
          <button
            v-if="auth.isEditor"
            type="button"
            class="btn-secondary"
            :disabled="linking !== null"
            @click="link(item)"
          >
            {{ linking === `${item.sourceSlug}:${item.startOffset}` ? '…' : t('pkm.createLink') }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.field-label-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.toolbar-field :deep(.app-select) {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-width: 0;
}
</style>
