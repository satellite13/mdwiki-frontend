<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as pagesApi from '@/api/pages'
import type { PageListItem } from '@/types'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const { t } = useI18n()
const dialog = useDialogStore()
const pages = ref<PageListItem[]>([])
const loading = ref(true)

function formatDeletedAt(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

async function fetchDeleted() {
  loading.value = true
  try {
    const { data } = await pagesApi.listDeletedPages()
    pages.value = data
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.loadTrashFailed')))
  } finally {
    loading.value = false
  }
}

async function restore(page: PageListItem) {
  try {
    await pagesApi.restorePage(page.slug)
    await fetchDeleted()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.restorePageFailed')))
  }
}

async function hardDelete(page: PageListItem) {
  const ok = await dialog.confirm(t('admin.confirmHardDelete', { title: page.title }), {
    danger: true,
    confirmLabel: t('admin.hardDelete')
  })
  if (!ok) return
  try {
    await pagesApi.deletePage(page.slug, 'hard')
    await fetchDeleted()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.hardDeletePageFailed')))
  }
}

onMounted(fetchDeleted)
</script>

<template>
  <div class="admin-trash">
    <div class="admin-nav" :aria-label="t('admin.sections')">
      <router-link to="/admin/users" class="admin-nav-link">{{ t('admin.openUsersSettings') }}</router-link>
      <router-link to="/admin/embedding" class="admin-nav-link">{{ t('admin.openEmbeddingSettings') }}</router-link>
      <router-link to="/admin/trash" class="admin-nav-link">{{ t('admin.openTrash') }}</router-link>
    </div>
    <h1>{{ t('admin.trashTitle') }}</h1>
    <p class="trash-subtitle">{{ t('admin.trashSubtitle') }}</p>
    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <p v-else-if="pages.length === 0" class="trash-empty">{{ t('admin.trashEmpty') }}</p>
    <div v-else class="table-scroll">
      <table class="data-table trash-table">
        <thead>
          <tr>
            <th>{{ t('admin.colTitle') }}</th>
            <th>{{ t('admin.colSlug') }}</th>
            <th>{{ t('admin.colDeletedAt') }}</th>
            <th>{{ t('admin.colActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in pages" :key="page.id">
            <td class="page-title" :data-label="t('admin.colTitle')">{{ page.title }}</td>
            <td class="page-slug" :data-label="t('admin.colSlug')">{{ page.slug }}</td>
            <td class="page-deleted-at" :data-label="t('admin.colDeletedAt')">{{ formatDeletedAt(page.deletedAt) }}</td>
            <td class="actions-cell">
              <button type="button" class="btn-restore" @click="restore(page)">
                {{ t('admin.restore') }}
              </button>
              <button type="button" class="btn-hard-delete" @click="hardDelete(page)">
                {{ t('admin.hardDelete') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 6px;
  width: fit-content;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  margin-bottom: 16px;
}

.admin-nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13px;
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.admin-nav-link:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-hover);
}

.admin-nav-link.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 600;
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.admin-trash h1 {
  font-family: var(--font-body);
  margin-bottom: 8px;
}

.trash-subtitle {
  margin: 0 0 28px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.trash-empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.trash-table tbody tr:hover {
  background: var(--color-bg-hover);
}

.page-title {
  font-weight: 500;
}

.page-slug {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 13px;
}

.page-deleted-at {
  color: var(--color-text-muted);
  font-size: 14px;
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.btn-restore,
.btn-hard-delete {
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  font-family: var(--font-body);
  font-size: 13px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.btn-restore:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.btn-hard-delete:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: rgba(207, 34, 46, 0.06);
}

@media (max-width: 767px) {
  .admin-nav {
    width: 100%;
    flex-wrap: wrap;
  }

  .admin-nav-link {
    flex: 1 1 auto;
    justify-content: center;
    font-size: 12px;
    padding: 0 8px;
  }

  .admin-trash h1 {
    font-size: 1.35rem;
    margin-bottom: 6px;
  }

  .trash-subtitle {
    margin-bottom: 20px;
  }

  .trash-table thead {
    display: none;
  }

  .trash-table,
  .trash-table tbody,
  .trash-table tr,
  .trash-table td {
    display: block;
  }

  .trash-table tr {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
    background: var(--color-bg);
    box-shadow: var(--shadow);
  }

  .trash-table td {
    padding: 3px 0;
    border-bottom: none;
    text-align: left;
  }

  .trash-table td::before {
    content: attr(data-label);
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--color-text-muted);
    width: 80px;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 15px;
    margin-bottom: 4px;
  }

  .page-title::before {
    display: none !important;
  }

  .actions-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border);
  }

  .actions-cell::before {
    display: none !important;
  }

  .btn-restore,
  .btn-hard-delete {
    min-height: 36px;
    min-width: 44px;
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>
