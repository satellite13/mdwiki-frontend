<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import * as apiKeysApi from '@/api/apiKeys'
import type { ApiKey } from '@/types'

const auth = useAuthStore()
const keys = ref<ApiKey[]>([])
const newKeyName = ref('')
const createdKey = ref<string | null>(null)
const loading = ref(true)

async function fetchKeys() {
  loading.value = true
  try { const { data } = await apiKeysApi.listApiKeys(); keys.value = data }
  finally { loading.value = false }
}

async function createKey() {
  if (!newKeyName.value.trim()) return
  const { data } = await apiKeysApi.createApiKey(newKeyName.value)
  createdKey.value = data.key
  newKeyName.value = ''
  fetchKeys()
}

async function deleteKey(id: string) {
  if (confirm('Delete this API key?')) { await apiKeysApi.deleteApiKey(id); fetchKeys() }
}

function copyKey() {
  if (createdKey.value) navigator.clipboard.writeText(createdKey.value)
}

onMounted(fetchKeys)
</script>

<template>
  <div class="profile-page">
    <h1>Profile</h1>
    <div class="profile-info">
      <p><strong>Username:</strong> {{ auth.username }}</p>
      <p><strong>Role:</strong> {{ auth.role }}</p>
    </div>

    <h2>API Keys</h2>
    <p class="hint">API keys are used to authenticate MCP clients (Claude, etc.) with your wiki.</p>

    <div v-if="createdKey" class="key-created">
      <p><strong>New key created!</strong> Copy it now — it won't be shown again.</p>
      <div class="key-display">
        <code>{{ createdKey }}</code>
        <button class="btn-secondary" @click="copyKey">Copy</button>
      </div>
      <button class="btn-secondary" @click="createdKey = null">Dismiss</button>
    </div>

    <div class="create-key">
      <input v-model="newKeyName" placeholder="Key name (e.g. Claude Desktop)" />
      <button class="btn-primary" @click="createKey">Create Key</button>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <table v-else-if="keys.length" class="keys-table">
      <thead><tr><th>Name</th><th>Created</th><th>Last Used</th><th></th></tr></thead>
      <tbody>
        <tr v-for="key in keys" :key="key.id">
          <td>{{ key.name }}</td>
          <td>{{ new Date(key.createdAt).toLocaleDateString() }}</td>
          <td>{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never' }}</td>
          <td><button class="btn-danger" @click="deleteKey(key.id)">Delete</button></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">No API keys yet.</p>
  </div>
</template>

<style scoped>
.profile-page h1 { margin-bottom: 16px; }
.profile-page h2 { margin-top: 32px; margin-bottom: 8px; }
.profile-info { margin-bottom: 16px; }
.profile-info p { margin-bottom: 4px; }
.hint { color: var(--color-text-muted); font-size: 14px; margin-bottom: 16px; }
.key-created { background: #f0fdf4; border: 1px solid var(--color-success); border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
.key-display { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
.key-display code { background: var(--color-bg-secondary); padding: 6px 12px; border-radius: 4px; font-size: 13px; word-break: break-all; flex: 1; }
.create-key { display: flex; gap: 8px; margin-bottom: 24px; }
.create-key input { max-width: 300px; }
.keys-table { width: 100%; border-collapse: collapse; }
.keys-table th, .keys-table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--color-border); }
.keys-table th { font-size: 13px; color: var(--color-text-muted); }
.loading, .empty { color: var(--color-text-muted); padding: 24px 0; }
</style>
