<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getEmbeddingSettings, updateEmbeddingSettings } from '@/api/embeddingSettings'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'
import type { EmbeddingSettings, EmbeddingSettingsWarning } from '@/types'

const dialog = useDialogStore()

const loading = ref(true)
const saving = ref(false)
const provider = ref<'openai' | 'ollama' | 'lmstudio'>('openai')
const model = ref('')
const expectedDimension = ref<number | null>(null)
const warning = ref<EmbeddingSettingsWarning | null>(null)

function applySettings(data: EmbeddingSettings) {
  provider.value = data.provider
  model.value = data.model
  expectedDimension.value = data.expectedDimension
  warning.value = data.warning ?? null
}

async function loadSettings() {
  loading.value = true
  try {
    const { data } = await getEmbeddingSettings()
    applySettings(data)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.errors.loadEmbeddingSettingsFailed))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const { data } = await updateEmbeddingSettings({
      provider: provider.value,
      model: model.value.trim()
    })
    applySettings(data)
    const mismatchMessage = data.warning
      ? `${t.admin.embeddingMismatchDetails(data.warning.actualDimension, data.warning.expectedDimension)}\n${t.admin.embeddingReindexHint}`
      : t.admin.embeddingReindexHint
    await dialog.alert(`${t.admin.embeddingSaveSuccess}\n${mismatchMessage}`)
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.errors.updateEmbeddingSettingsFailed))
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="admin-embedding">
    <div class="admin-nav">
      <router-link to="/admin/users" class="admin-nav-link">{{ t.admin.openUsersSettings }}</router-link>
      <router-link to="/admin/embedding" class="admin-nav-link active">{{ t.admin.openEmbeddingSettings }}</router-link>
    </div>
    <h1>{{ t.admin.embeddingTitle }}</h1>

    <div v-if="loading" class="state-placeholder">Loading...</div>
    <form v-else class="settings-form" @submit.prevent="saveSettings">
      <label class="field">
        <span>{{ t.admin.embeddingProviderLabel }}</span>
        <select v-model="provider">
          <option value="openai">openai</option>
          <option value="ollama">ollama</option>
          <option value="lmstudio">lmstudio</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t.admin.embeddingModelLabel }}</span>
        <input v-model="model" required />
      </label>

      <label class="field">
        <span>{{ t.admin.embeddingExpectedDimensionLabel }}</span>
        <input :value="expectedDimension ?? '—'" readonly />
      </label>

      <p class="hint">{{ t.admin.embeddingReindexHint }}</p>
      <p v-if="warning" class="warning">
        <strong>{{ t.admin.embeddingMismatchTitle }}:</strong>
        {{ t.admin.embeddingMismatchDetails(warning.actualDimension, warning.expectedDimension) }}
      </p>

      <button class="btn-primary" type="submit" :disabled="saving">
        {{ saving ? 'Saving…' : t.common.save }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.admin-nav {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.admin-nav-link {
  font-size: 13px;
  color: var(--color-text-muted);
  text-decoration: none;
}

.admin-nav-link.active {
  color: var(--color-text);
  font-weight: 600;
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
