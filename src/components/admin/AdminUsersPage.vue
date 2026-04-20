<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as usersApi from '@/api/users'
import type { User, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'

const auth = useAuthStore()
const dialog = useDialogStore()
const users = ref<User[]>([])
const loading = ref(true)

const VALID_ROLES: readonly UserRole[] = ['READER', 'EDITOR', 'ADMIN']

function toUserRole(value: string): UserRole | null {
  return (VALID_ROLES as readonly string[]).includes(value) ? (value as UserRole) : null
}

async function fetchUsers() {
  loading.value = true
  try {
    const { data } = await usersApi.listUsers()
    users.value = data
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.errors.loadUsersFailed))
  } finally {
    loading.value = false
  }
}

async function changeRole(user: User, newRole: string) {
  const role = toUserRole(newRole)
  if (!role) return
  try {
    await usersApi.updateUserRole(user.id, role)
    await fetchUsers()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.errors.updateRoleFailed))
  }
}

async function removeUser(user: User) {
  if (user.username === auth.username) return
  const ok = await dialog.confirm(t.admin.confirmDeleteUser(user.username), {
    danger: true,
    confirmLabel: t.admin.delete
  })
  if (!ok) return
  try {
    await usersApi.deleteUser(user.id)
    await fetchUsers()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.errors.deleteUserFailed))
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="admin-users">
    <h1>User Management</h1>
    <div v-if="loading" class="state-placeholder">Loading...</div>
    <table v-else class="data-table users-table">
      <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td class="user-name">{{ user.username }}</td>
          <td class="user-email">{{ user.email }}</td>
          <td><span class="role-badge">{{ user.role }}</span></td>
          <td class="actions-cell">
            <select :value="user.role" @change="changeRole(user, ($event.target as HTMLSelectElement).value)">
              <option value="READER">READER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              v-if="user.username !== auth.username"
              type="button"
              class="btn-delete-user"
              @click="removeUser(user)"
            >
              {{ t.admin.delete }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.admin-users h1 {
  font-family: var(--font-body);
  margin-bottom: 28px;
}

.users-table tbody tr:hover {
  background: var(--color-bg-hover);
}

.user-name {
  font-weight: 500;
}

.user-email {
  color: var(--color-text-muted);
  font-size: 14px;
}

.role-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--color-primary-light);
  padding: 3px 8px;
  border-radius: 4px;
  color: var(--color-primary);
  font-weight: 500;
}

.users-table select {
  padding: 6px 10px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  font-family: var(--font-body);
  font-size: 13px;
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
  width: auto;
}

.users-table select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.12);
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.btn-delete-user {
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

.btn-delete-user:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: rgba(207, 34, 46, 0.06);
}

</style>
