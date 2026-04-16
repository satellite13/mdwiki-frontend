<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const searchQuery = ref('')

function onSearch() {
  if (searchQuery.value.trim()) {
    router.push({ name: 'search', query: { q: searchQuery.value } })
  }
}

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="logo">MDWiki</router-link>
    <form class="search-form" @submit.prevent="onSearch">
      <input v-model="searchQuery" placeholder="Search pages..." type="search" />
    </form>
    <nav class="header-nav">
      <router-link to="/profile" class="nav-link">{{ auth.username }}</router-link>
      <router-link v-if="auth.isAdmin" to="/admin/users" class="nav-link">Admin</router-link>
      <button class="btn-secondary" @click="logout">Logout</button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 48px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.logo {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
  transition: color 0.15s;
}

.logo:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.search-form { flex: 1; max-width: 360px; }
.search-form input {
  font-size: 13px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.nav-link {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
}

.nav-link:hover {
  color: var(--color-text);
  text-decoration: none;
}
</style>
