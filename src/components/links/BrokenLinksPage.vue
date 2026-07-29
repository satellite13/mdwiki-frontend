<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as linksApi from '@/api/links'
import { getPages, pageMatchesWikilinkQuery } from '@/services/pageIndex'
import type { BrokenLink, PageListItem } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import AppModal from '@/components/ui/AppModal.vue'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

interface BrokenLinkGroup {
  brokenTarget: string
  items: BrokenLink[]
}

const auth = useAuthStore()
const dialog = useDialogStore()
const router = useRouter()

const links = ref<BrokenLink[]>([])
const loading = ref(true)
const fixing = ref(false)

const fixOpen = ref(false)
const fixFromTarget = ref('')
const fixSourceSlug = ref<string | undefined>(undefined)
const fixBulk = ref(false)
const pageQuery = ref('')
const pageSuggestions = ref<PageListItem[]>([])
const selectedPage = ref<PageListItem | null>(null)

const groups = computed<BrokenLinkGroup[]>(() => {
  const map = new Map<string, BrokenLink[]>()
  for (const item of links.value) {
    const bucket = map.get(item.brokenTarget) ?? []
    bucket.push(item)
    map.set(item.brokenTarget, bucket)
  }
  return [...map.entries()]
    .map(([brokenTarget, items]) => ({ brokenTarget, items }))
    .sort((a, b) => a.brokenTarget.localeCompare(b.brokenTarget, 'ru', { sensitivity: 'base' }))
})

async function fetchBrokenLinks() {
  loading.value = true
  try {
    const { data } = await linksApi.listBrokenLinks()
    links.value = data
  } catch (e) {
    links.value = []
    await dialog.alert(getApiErrorMessage(e, t.brokenLinks.loadFailed))
  } finally {
    loading.value = false
  }
}

function kindLabel(kind: BrokenLink['kind']): string {
  return kind === 'WIKILINK' ? t.brokenLinks.kindWikilink : t.brokenLinks.kindMarkdown
}

function openSource(slug: string) {
  void router.push({ name: 'page', params: { slug } })
}

async function refreshPageSuggestions() {
  const query = pageQuery.value.trim()
  const pages = await getPages()
  const filtered = query
    ? pages.filter((item) => pageMatchesWikilinkQuery(item, query))
    : pages
  pageSuggestions.value = filtered
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }))
    .slice(0, 12)
  if (selectedPage.value && !pages.some((p) => p.slug === selectedPage.value?.slug)) {
    selectedPage.value = null
  }
}

function openFixDialog(brokenTarget: string, options: { sourceSlug?: string; bulk?: boolean } = {}) {
  if (!auth.isEditor) return
  fixFromTarget.value = brokenTarget
  fixSourceSlug.value = options.sourceSlug
  fixBulk.value = options.bulk ?? false
  pageQuery.value = ''
  selectedPage.value = null
  pageSuggestions.value = []
  fixOpen.value = true
  void refreshPageSuggestions()
}

function closeFixDialog() {
  fixOpen.value = false
}

function choosePage(page: PageListItem) {
  selectedPage.value = page
  pageQuery.value = page.title
}

async function applyFix() {
  if (!selectedPage.value || fixing.value) return
  const title = fixBulk.value
    ? t.brokenLinks.fixAllConfirm(fixFromTarget.value, selectedPage.value.title)
    : t.brokenLinks.fixOneConfirm(fixFromTarget.value, selectedPage.value.title)
  const ok = await dialog.confirm(title, { confirmLabel: t.brokenLinks.fixButton })
  if (!ok) return

  fixing.value = true
  try {
    const { data } = await linksApi.rewriteBrokenLinks({
      fromTarget: fixFromTarget.value,
      toSlug: selectedPage.value.slug,
      sourceSlug: fixBulk.value ? undefined : fixSourceSlug.value,
    })
    closeFixDialog()
    await fetchBrokenLinks()
    if (data.skippedLocked.length > 0) {
      await dialog.alert(t.brokenLinks.fixDoneWithSkipped(data.pagesUpdated, data.skippedLocked.join(', ')))
    } else {
      await dialog.alert(t.brokenLinks.fixDone(data.pagesUpdated))
    }
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.brokenLinks.fixFailed))
  } finally {
    fixing.value = false
  }
}

onMounted(fetchBrokenLinks)
</script>

<template>
  <div class="grouped-page">
    <div class="page-header">
      <div>
        <h1>{{ t.brokenLinks.title }}</h1>
        <p class="page-subtitle">{{ t.brokenLinks.subtitle }}</p>
      </div>
      <button type="button" class="btn-secondary" :disabled="loading" @click="fetchBrokenLinks">
        {{ t.brokenLinks.refresh }}
      </button>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>

    <div v-else-if="links.length === 0" class="empty-state">
      {{ t.brokenLinks.empty }}
    </div>

    <div v-else class="groups">
      <section v-for="group in groups" :key="group.brokenTarget" class="group-card">
        <div class="group-header">
          <div>
            <h2 class="group-title">{{ group.brokenTarget }}</h2>
            <p class="group-meta">{{ t.brokenLinks.occurrences(group.items.length) }}</p>
          </div>
          <button
            v-if="auth.isEditor"
            type="button"
            class="btn-primary btn-sm"
            @click="openFixDialog(group.brokenTarget, { bulk: true })"
          >
            {{ t.brokenLinks.fixAll }}
          </button>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t.brokenLinks.colSource }}</th>
                <th>{{ t.brokenLinks.colType }}</th>
                <th>{{ t.brokenLinks.colLabel }}</th>
                <th v-if="auth.isEditor">{{ t.brokenLinks.colActions }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in group.items" :key="`${item.sourceSlug}-${item.kind}-${index}`">
                <td data-label="Source">
                  <button type="button" class="link-btn" @click="openSource(item.sourceSlug)">
                    {{ item.sourceTitle }}
                  </button>
                  <small class="slug-hint">{{ item.sourceSlug }}</small>
                </td>
                <td data-label="Type">{{ kindLabel(item.kind) }}</td>
                <td data-label="Label">{{ item.displayText || '—' }}</td>
                <td v-if="auth.isEditor" class="actions-cell" data-label="Actions">
                  <button type="button" class="btn-secondary btn-sm" @click="openSource(item.sourceSlug)">
                    {{ t.brokenLinks.open }}
                  </button>
                  <button
                    type="button"
                    class="btn-primary btn-sm"
                    @click="openFixDialog(item.brokenTarget, { sourceSlug: item.sourceSlug })"
                  >
                    {{ t.brokenLinks.fixHere }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <AppModal v-if="fixOpen" :label="t.brokenLinks.fixDialogTitle" @close="closeFixDialog">
      <h2>{{ t.brokenLinks.fixDialogTitle }}</h2>
      <p class="fix-from">
        {{ t.brokenLinks.fixFrom }} <code>{{ fixFromTarget }}</code>
        <span v-if="!fixBulk && fixSourceSlug"> · {{ t.brokenLinks.fixOnPage }} <code>{{ fixSourceSlug }}</code></span>
        <span v-else-if="fixBulk"> · {{ t.brokenLinks.fixAllPages }}</span>
      </p>

      <label class="field-label" for="fix-page-query">{{ t.brokenLinks.pickTarget }}</label>
      <input
        id="fix-page-query"
        v-model="pageQuery"
        type="text"
        class="field-input"
        autocomplete="off"
        :placeholder="t.brokenLinks.pickTargetPlaceholder"
        @input="refreshPageSuggestions"
      />

      <ul v-if="pageSuggestions.length > 0" class="page-suggestions">
        <li v-for="page in pageSuggestions" :key="page.slug">
          <button
            type="button"
            class="suggestion-btn"
            :class="{ active: selectedPage?.slug === page.slug }"
            @click="choosePage(page)"
          >
            <span>{{ page.title }}</span>
            <small>{{ page.slug }}</small>
          </button>
        </li>
      </ul>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" :disabled="fixing" @click="closeFixDialog">
          {{ t.common.cancel }}
        </button>
        <button type="button" class="btn-primary" :disabled="!selectedPage || fixing" @click="applyFix">
          {{ fixing ? '…' : t.brokenLinks.fixButton }}
        </button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #d0d7de);
  background: color-mix(in srgb, var(--color-border, #d0d7de) 18%, transparent);
}

.slug-hint {
  display: block;
  color: var(--color-text-muted, #656d76);
  margin-top: 0.15rem;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.fix-from {
  margin: 0.5rem 0 1rem;
  color: var(--color-text-muted, #656d76);
}

.page-suggestions {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--color-border, #d0d7de);
  border-radius: 8px;
}

.suggestion-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  border: 0;
  background: transparent;
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}

.suggestion-btn:hover,
.suggestion-btn.active {
  background: color-mix(in srgb, var(--color-wikilink, #0d9488) 12%, transparent);
}

.suggestion-btn small {
  color: var(--color-text-muted, #656d76);
}
</style>
