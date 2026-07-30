<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getEmbeddingSettings, updateEmbeddingSettings } from '@/api/embeddingSettings'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import type { EmbeddingSettings, EmbeddingSettingsWarning } from '@/types'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

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

onMounted(loadSettings)
</script>

<template>
  <div class="admin-embedding">
    <div class="admin-nav" :aria-label="t('admin.sections')">
      <router-link to="/admin/users" class="admin-nav-link">{{ t('admin.openUsersSettings') }}</router-link>
      <router-link to="/admin/embedding" class="admin-nav-link">{{ t('admin.openEmbeddingSettings') }}</router-link>
      <router-link to="/admin/trash" class="admin-nav-link">{{ t('admin.openTrash') }}</router-link>
    </div>
    <h1>{{ t('admin.embeddingTitle') }}</h1>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="form" /></div>
    <form v-else class="settings-form" @submit.prevent="saveSettings">
      <label class="field">
        <span>{{ t('admin.embeddingProviderLabel') }}</span>
        <select v-model="provider">
          <option value="openai">openai</option>
          <option value="ollama">ollama</option>
          <option value="lmstudio">lmstudio</option>
        </select>
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

      <button class="btn-primary" type="submit" :disabled="saving">
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </form>
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
.field select {
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
</style>
