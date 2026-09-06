<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getEmbeddingSettings, updateEmbeddingSettings } from '@/api/embeddingSettings'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import type { EmbeddingSettings, EmbeddingSettingsWarning } from '@/types'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'
import { postWikiReindex } from '@/api/sync'
import AdminNav from '@/components/admin/AdminNav.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { t } = useI18n()
const dialog = useDialogStore()

const loading = ref(true)
const saving = ref(false)
const provider = ref<'openai' | 'ollama' | 'lmstudio'>('openai')
const model = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const apiKeyConfigured = ref(false)
const expectedDimension = ref<number | null>(null)
const warning = ref<EmbeddingSettingsWarning | null>(null)
const reindexing = ref(false)
const reindexStatus = ref('')
const providerOptions = [
  { value: 'openai', label: 'openai' },
  { value: 'ollama', label: 'ollama' },
  { value: 'lmstudio', label: 'lmstudio' },
]

function applySettings(data: EmbeddingSettings) {
  provider.value = data.provider
  model.value = data.model
  baseUrl.value = data.baseUrl
  apiKeyConfigured.value = data.apiKeyConfigured
  apiKey.value = ''
  expectedDimension.value = data.expectedDimension
  warning.value = data.warning ?? null
}

async function loadSettings() {
  loading.value = true
  try {
    const { data } = await getEmbeddingSettings()
    applySettings(data)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.loadEmbeddingSettingsFailed')))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const payload = {
      provider: provider.value,
      model: model.value.trim(),
      baseUrl: baseUrl.value.trim() || null
    } as const
    const keyValue = apiKey.value.trim()
    const { data } = await updateEmbeddingSettings(
      keyValue
        ? { ...payload, apiKey: keyValue }
        : payload
    )
    applySettings(data)
    const mismatchMessage = data.warning
      ? `${t('admin.embeddingMismatchDetails', { actual: data.warning.actualDimension, expected: data.warning.expectedDimension })}\n${t('admin.embeddingReindexHint')}`
      : t('admin.embeddingReindexHint')
    await dialog.alert(`${t('admin.embeddingSaveSuccess')}\n${mismatchMessage}`)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.updateEmbeddingSettingsFailed')))
  } finally {
    saving.value = false
  }
}

async function reindex() {
  if (reindexing.value) return
  reindexing.value = true
  reindexStatus.value = t('admin.embeddingReindexRunning')
  try {
    const { data } = await postWikiReindex()
    reindexStatus.value = t('admin.embeddingReindexDone', {
      total: data.total,
      reindexed: data.reindexed,
      failed: data.failed
    })
  } catch (error) {
    reindexStatus.value = ''
    await dialog.alert(getApiErrorMessage(error, t('admin.embeddingReindexFailed')))
  } finally {
    reindexing.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="admin-embedding">
    <AdminNav />
    <h1>{{ t('admin.embeddingTitle') }}</h1>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="form" /></div>
    <form v-else class="settings-form" @submit.prevent="saveSettings">
      <label class="field">
        <span>{{ t('admin.embeddingProviderLabel') }}</span>
        <AppSelect
          v-model="provider"
          :options="providerOptions"
          :aria-label="t('admin.embeddingProviderLabel')"
        />
      </label>

      <label class="field">
        <span>{{ t('admin.embeddingModelLabel') }}</span>
        <input v-model="model" required />
      </label>

      <label class="field">
        <span>{{ t('admin.embeddingBaseUrlLabel') }}</span>
        <input v-model="baseUrl" type="url" placeholder="https://..." />
      </label>

      <label class="field">
        <span>{{ t('admin.embeddingApiKeyLabel') }}</span>
        <input v-model="apiKey" type="password" autocomplete="new-password" />
      </label>
      <p class="hint">
        {{ t('admin.embeddingApiKeyHint') }}
        {{ apiKeyConfigured ? t('admin.embeddingApiKeyConfigured') : t('admin.embeddingApiKeyMissing') }}
      </p>

      <label class="field">
        <span>{{ t('admin.embeddingExpectedDimensionLabel') }}</span>
        <input :value="expectedDimension ?? '—'" readonly />
      </label>

      <p class="hint">{{ t('admin.embeddingReindexHint') }}</p>
      <p v-if="warning" class="warning">
        <strong>{{ t('admin.embeddingMismatchTitle') }}:</strong>
        {{ t('admin.embeddingMismatchDetails', { actual: warning.actualDimension, expected: warning.expectedDimension }) }}
      </p>

      <div class="settings-actions">
        <button class="btn-primary" type="submit" :disabled="saving || reindexing">
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
        <button
          class="btn-secondary reindex-button"
          type="button"
          :disabled="saving || reindexing"
          :aria-busy="reindexing"
          @click="reindex"
        >
          {{ reindexing ? t('admin.embeddingReindexRunning') : t('admin.embeddingReindexButton') }}
        </button>
      </div>
      <p v-if="reindexStatus" class="hint reindex-status" aria-live="polite">{{ reindexStatus }}</p>
    </form>
  </div>
</template>

<style scoped>
.admin-embedding h1 {
  margin-bottom: 20px;
}

.settings-form {
  max-width: 520px;
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 13px;
  color: var(--color-text-muted);
}

.field input,
.field :deep(.app-select) {
  width: 100%;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.warning {
  margin: 0;
  font-size: 13px;
  color: var(--color-warning, #9a6700);
}

.settings-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
