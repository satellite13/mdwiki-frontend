<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import * as apiKeysApi from '@/api/apiKeys'
import { changePassword } from '@/api/auth'
import type { ApiKey } from '@/types'
import { getApiErrorMessage } from '@/utils/apiError'
import { copyTextToClipboard } from '@/utils/clipboard'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const { t } = useI18n()
const auth = useAuthStore()
const dialog = useDialogStore()
const PASSWORD_MIN_LENGTH = 8
const keys = ref<ApiKey[]>([])
const newKeyName = ref('')
const createdKey = ref<string | null>(null)
const loading = ref(true)
const copyState = ref<'idle' | 'ok' | 'fail'>('idle')
let copyFeedbackTimer: number | null = null

// Change password state
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const showPassword = ref(false)

async function fetchKeys() {
  loading.value = true
  try {
    const { data } = await apiKeysApi.listApiKeys()
    keys.value = data
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.loadApiKeysFailed')))
  } finally {
    loading.value = false
  }
}

async function createKey() {
  if (!newKeyName.value.trim()) return
  try {
    const { data } = await apiKeysApi.createApiKey(newKeyName.value)
    createdKey.value = data.key
    newKeyName.value = ''
    await fetchKeys()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.createApiKeyFailed')))
  }
}

async function deleteKey(id: string) {
  const ok = await dialog.confirm(t('profile.confirmDeleteApiKey'), {
    danger: true,
    confirmLabel: t('tree.delete')
  })
  if (!ok) return
  try {
    await apiKeysApi.deleteApiKey(id)
    await fetchKeys()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.deleteApiKeyFailed')))
  }
}

async function changePasswordAction() {
  if (newPassword.value.length < PASSWORD_MIN_LENGTH) {
    await dialog.alert(t('profile.passwordMinLength'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    await dialog.alert(t('profile.passwordsDoNotMatch'))
    return
  }
  if (!currentPassword.value) {
    return
  }

  passwordLoading.value = true
  try {
    await changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    })
    await dialog.alert(t('profile.passwordChanged'))
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.changePasswordFailed')))
  } finally {
    passwordLoading.value = false
  }
}

function setCopyFeedback(state: 'ok' | 'fail') {
  if (copyFeedbackTimer) window.clearTimeout(copyFeedbackTimer)
  copyState.value = state
  copyFeedbackTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1300)
}

async function copyKey() {
  if (!createdKey.value) return
  const copied = await copyTextToClipboard(createdKey.value)
  setCopyFeedback(copied ? 'ok' : 'fail')
  if (!copied) {
    await dialog.alert(t('profile.copyManual'))
  }
}

onMounted(fetchKeys)

onBeforeUnmount(() => {
  if (copyFeedbackTimer) window.clearTimeout(copyFeedbackTimer)
})
</script>

<template>
  <div class="profile-page">
    <h1>{{ t('profile.title') }}</h1>
    <div class="profile-card">
      <p><strong>{{ t('profile.usernameLabel') }}</strong> {{ auth.username }}</p>
      <p><strong>{{ t('profile.roleLabel') }}</strong> <span class="role-badge">{{ auth.role }}</span></p>
    </div>

    <h2>{{ t('profile.changePasswordTitle') }}</h2>
    <p class="hint">{{ t('profile.changePasswordHint') }}</p>

    <form class="password-form" @submit.prevent="changePasswordAction">
      <div class="form-field">
        <label>{{ t('profile.currentPassword') }}</label>
        <input v-model="currentPassword" type="password" autocomplete="current-password" />
      </div>
      <div class="form-field">
        <label>{{ t('profile.newPassword') }}</label>
        <div class="password-input-row">
          <input
            v-model="newPassword"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            :minlength="PASSWORD_MIN_LENGTH"
          />
          <button type="button" class="btn-secondary toggle-btn" @click="showPassword = !showPassword">
            {{ showPassword ? t('common.hide') : t('common.show') }}
          </button>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('profile.confirmPassword') }}</label>
        <input v-model="confirmPassword" type="password" autocomplete="new-password" />
      </div>
      <button type="submit" class="btn-primary" :disabled="passwordLoading">
        {{ passwordLoading ? t('common.saving') : t('common.save') }}
      </button>
    </form>

    <h2>{{ t('profile.apiKeysTitle') }}</h2>
    <p class="hint">{{ t('profile.apiKeysHint') }}</p>

    <div v-if="createdKey" class="key-created">
      <p><strong>{{ t('profile.keyCreatedTitle') }}</strong> {{ t('profile.keyCreatedCopyHint') }}</p>
      <div class="key-display">
        <code>{{ createdKey }}</code>
        <button class="btn-secondary" :class="{ copied: copyState === 'ok', failed: copyState === 'fail' }" @click="copyKey">
          {{ copyState === 'ok' ? t('profile.copied') : copyState === 'fail' ? t('profile.copyStateFailed') : t('profile.copy') }}
        </button>
      </div>
      <button class="btn-secondary" @click="createdKey = null">{{ t('profile.dismiss') }}</button>
    </div>

    <div class="create-key">
      <input v-model="newKeyName" :placeholder="t('profile.keyNamePlaceholder')" />
      <button class="btn-primary" @click="createKey">{{ t('profile.createKey') }}</button>
    </div>

    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <table v-else-if="keys.length" class="data-table keys-table">
      <thead><tr><th>{{ t('profile.colName') }}</th><th>{{ t('profile.colCreated') }}</th><th>{{ t('profile.colLastUsed') }}</th><th></th></tr></thead>
      <tbody>
        <tr v-for="key in keys" :key="key.id">
          <td class="key-name">{{ key.name }}</td>
          <td class="key-date">{{ new Date(key.createdAt).toLocaleDateString() }}</td>
          <td class="key-date">{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : t('common.never') }}</td>
          <td><button class="btn-danger btn-sm" @click="deleteKey(key.id)">{{ t('tree.delete') }}</button></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="state-placeholder">{{ t('profile.noApiKeys') }}</p>
  </div>
</template>

<style scoped>
.profile-page h1 {
  font-family: var(--font-body);
  margin-bottom: 20px;
}

.profile-page h2 {
  font-family: var(--font-body);
  margin-top: 36px;
  margin-bottom: 8px;
  font-size: 1.3rem;
}

.profile-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin-bottom: 8px;
}

.profile-card p {
  margin-bottom: 6px;
  font-size: 15px;
}

.profile-card p:last-child {
  margin-bottom: 0;
}

.role-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--color-primary);
  font-weight: 500;
}

.hint {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 20px;
}

.password-form {
  max-width: 420px;
  margin-bottom: 8px;
}

.form-field {
  margin-bottom: 16px;
}

.form-field label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
}

.form-field input {
  width: 100%;
}

.password-input-row {
  display: flex;
  gap: 8px;
}

.password-input-row input {
  flex: 1;
}

.toggle-btn {
  white-space: nowrap;
  padding: 6px 14px;
  font-size: 13px;
}

.password-form .btn-primary {
  margin-top: 4px;
}

.key-created {
  background: rgba(13, 148, 136, 0.06);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
  padding: 18px 20px;
  margin-bottom: 20px;
}

.key-created p {
  margin-bottom: 4px;
}

.key-display {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}

.key-display code {
  font-family: var(--font-mono);
  background: var(--color-bg-tertiary);
  padding: 8px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  word-break: break-all;
  flex: 1;
  border: 1px solid var(--color-border);
}

.create-key {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
}

.create-key input {
  max-width: 320px;
}

.keys-table tbody tr:hover {
  background: var(--color-bg-hover);
}

.key-name {
  font-weight: 500;
}

.key-date {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-text-muted);
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.key-display .btn-secondary.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}

.key-display .btn-secondary.failed {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

@media (max-width: 767px) {
  .profile-page h1 {
    font-size: 1.35rem;
    margin-bottom: 16px;
  }

  .profile-page h2 {
    font-size: 1.15rem;
    margin-top: 28px;
  }

  .profile-card {
    padding: 14px 16px;
  }

  .profile-card p {
    font-size: 14px;
  }

  .hint {
    font-size: 13px;
  }

  .password-form {
    max-width: 100%;
  }

  .password-form .btn-primary {
    width: 100%;
    min-height: 44px;
  }

  .key-created {
    padding: 14px 16px;
  }

  .key-display {
    flex-direction: column;
    gap: 8px;
  }

  .key-display code {
    font-size: 12px;
    padding: 10px 12px;
    width: 100%;
  }

  .key-display .btn-secondary {
    align-self: flex-start;
    min-height: 36px;
    min-width: 44px;
  }

  .create-key {
    flex-direction: column;
    gap: 8px;
  }

  .create-key input {
    max-width: 100%;
  }

  .create-key .btn-primary {
    width: 100%;
    min-height: 44px;
  }

  /* keys table → cards */
  .keys-table thead {
    display: none;
  }

  .keys-table,
  .keys-table tbody,
  .keys-table tr,
  .keys-table td {
    display: block;
  }

  .keys-table tr {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 12px 14px;
    margin-bottom: 10px;
    background: var(--color-bg);
    box-shadow: var(--shadow);
  }

  .keys-table td {
    padding: 3px 0;
    border-bottom: none;
    text-align: left;
  }

  .key-name {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .key-date {
    font-size: 12px;
  }

  .keys-table td:last-child {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .btn-sm {
    min-height: 36px;
    min-width: 44px;
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>
