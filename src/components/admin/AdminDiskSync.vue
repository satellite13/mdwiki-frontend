<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '@/stores/dialog'
import { useFolderStore } from '@/stores/folders'
import { postWikiFullSync } from '@/api/sync'
import { getApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const dialog = useDialogStore()
const folderStore = useFolderStore()
const loading = ref(false)

async function syncFromDisk() {
  const ok = await dialog.confirm(t('admin.syncWikiConfirm'), {
    title: t('admin.syncWikiTitle'),
    confirmLabel: t('admin.syncWikiButton')
  })
  if (!ok) return
  loading.value = true
  try {
    const { data } = await postWikiFullSync()
    await folderStore.fetchTree(true)
    await dialog.alert(t('admin.syncWikiDone', {
      added: data.added,
      updated: data.updated,
      removed: data.removed
    }))
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('admin.syncWikiFailed')))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="admin-disk-sync" :aria-label="t('admin.syncWikiTitle')">
    <div>
      <h2>{{ t('admin.syncWikiTitle') }}</h2>
      <p>{{ t('admin.syncWikiHint') }}</p>
    </div>
    <button type="button" class="btn-secondary" :disabled="loading" @click="syncFromDisk">
      {{ loading ? '…' : t('admin.syncWikiButton') }}
    </button>
  </section>
</template>

<style scoped>
.admin-disk-sync {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 24px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-secondary);
}

.admin-disk-sync h2 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-family: var(--font-body);
}

.admin-disk-sync p {
  margin: 0;
  max-width: 42rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.4;
}
</style>
