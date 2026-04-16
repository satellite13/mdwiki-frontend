<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as usersApi from '@/api/users'
import type { User } from '@/types'

const users = ref<User[]>([])
const loading = ref(true)

async function fetchUsers() {
  loading.value = true
  try { const { data } = await usersApi.listUsers(); users.value = data }
  finally { loading.value = false }
}

async function changeRole(user: User, newRole: string) {
  await usersApi.updateUserRole(user.id, newRole)
  fetchUsers()
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
          <td>
            <select :value="user.role" @change="changeRole(user, ($event.target as HTMLSelectElement).value)">
              <option value="READER">READER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
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

.users-table tbody tr:nth-child(even) {
  background: #262626;
}

.users-table tbody tr:nth-child(odd) {
  background: #2d2d2d;
}

.users-table tbody tr:hover {
  background: #333333;
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
  background: #2d2d2d;
  padding: 3px 8px;
  border-radius: 3px;
  color: var(--color-text-muted);
  border: 1px solid #3a3a3a;
}

.users-table select {
  padding: 6px 10px;
  border-radius: var(--radius);
  border: 1px solid #3a3a3a;
  font-family: var(--font-body);
  font-size: 13px;
  background: #2d2d2d;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
  width: auto;
}

.users-table select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
}

</style>
