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
    <div v-if="loading" class="loading">Loading...</div>
    <table v-else class="users-table">
      <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.username }}</td>
          <td>{{ user.email }}</td>
          <td>{{ user.role }}</td>
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
.admin-users h1 { margin-bottom: 24px; }
.users-table { width: 100%; border-collapse: collapse; }
.users-table th, .users-table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--color-border); }
.users-table th { font-size: 13px; color: var(--color-text-muted); }
.users-table select { padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); }
.loading { color: var(--color-text-muted); padding: 40px 0; text-align: center; }
</style>
