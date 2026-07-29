<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as usersApi from '@/api/users'
import type { User, UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useDialogStore } from '@/stores/dialog'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'
import SkeletonPage from '@/components/ui/SkeletonPage.vue'

const { t } = useI18n()
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
    await dialog.alert(getApiErrorMessage(e, t('errors.loadUsersFailed')))
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
    await dialog.alert(getApiErrorMessage(e, t('errors.updateRoleFailed')))
  }
}

async function removeUser(user: User) {
  if (user.username === auth.username) return
  const ok = await dialog.confirm(t('admin.confirmDeleteUser', { username: user.username }), {
    danger: true,
    confirmLabel: t('admin.delete')
  })
  if (!ok) return
  try {
    await usersApi.deleteUser(user.id)
    await fetchUsers()
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t('errors.deleteUserFailed')))
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="admin-users">
    <div class="admin-nav" :aria-label="t('admin.sections')">
      <router-link to="/admin/users" class="admin-nav-link">{{ t('admin.openUsersSettings') }}</router-link>
      <router-link to="/admin/embedding" class="admin-nav-link">{{ t('admin.openEmbeddingSettings') }}</router-link>
    </div>
    <h1>{{ t('admin.usersTitle') }}</h1>
    <div v-if="loading" class="state-placeholder"><SkeletonPage variant="table" /></div>
    <div v-else class="table-scroll">
    <table class="data-table users-table">
      <thead><tr><th>{{ t('admin.colUsername') }}</th><th>{{ t('admin.colEmail') }}</th><th>{{ t('admin.colRole') }}</th><th>{{ t('admin.colActions') }}</th></tr></thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td class="user-name" data-label="Username">{{ user.username }}</td>
          <td class="user-email" data-label="Email">{{ user.email }}</td>
          <td class="role-cell" data-label="Role"><span class="role-badge">{{ user.role }}</span></td>
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
              {{ t('admin.delete') }}
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

  .admin-users h1 {
    font-size: 1.35rem;
    margin-bottom: 20px;
  }

  .users-table thead {
    display: none;
  }

  .users-table,
  .users-table tbody,
  .users-table tr,
  .users-table td {
    display: block;
  }

  .users-table tr {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 14px;
    margin-bottom: 12px;
    background: var(--color-bg);
    box-shadow: var(--shadow);
  }

  .users-table td {
    padding: 3px 0;
    border-bottom: none;
    text-align: left;
  }

  .users-table td::before {
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

  .user-name {
    font-size: 15px;
    margin-bottom: 4px;
  }

  .user-name::before {
    display: none !important;
  }

  .role-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .role-cell .role-badge {
    font-size: 12px;
    padding: 4px 10px;
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

  .users-table select {
    min-height: 36px;
    min-width: 44px;
    padding: 6px 12px;
    font-size: 13px;
  }

  .btn-delete-user {
    min-height: 36px;
    min-width: 44px;
    padding: 6px 14px;
    font-size: 13px;
  }
}

</style>
