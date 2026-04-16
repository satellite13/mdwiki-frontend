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
    <div class="profile-card">
      <p><strong>Username:</strong> {{ auth.username }}</p>
      <p><strong>Role:</strong> <span class="role-badge">{{ auth.role }}</span></p>
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
          <td class="key-name">{{ key.name }}</td>
          <td class="key-date">{{ new Date(key.createdAt).toLocaleDateString() }}</td>
          <td class="key-date">{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never' }}</td>
          <td><button class="btn-danger btn-sm" @click="deleteKey(key.id)">Delete</button></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">No API keys yet.</p>
  </div>
</template>

<style scoped>
.profile-page h1 {
  font-family: var(--font-heading);
  margin-bottom: 20px;
}

.profile-page h2 {
  font-family: var(--font-heading);
  margin-top: 36px;
  margin-bottom: 8px;
  font-size: 1.3rem;
}

.profile-card {
  background: var(--color-bg);
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
  background: var(--color-bg-secondary);
  padding: 2px 8px;
  border-radius: 3px;
  color: var(--color-text-muted);
}

.hint {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 20px;
}

.key-created {
  background: rgba(39, 174, 96, 0.06);
  border: 1px solid rgba(39, 174, 96, 0.3);
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
  background: var(--color-bg-secondary);
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

.keys-table {
  width: 100%;
  border-collapse: collapse;
}

.keys-table th,
.keys-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
}

.keys-table th {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  background: var(--color-bg-secondary);
}

.keys-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.015);
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

.loading, .empty {
  color: var(--color-text-muted);
  padding: 24px 0;
}
</style>
