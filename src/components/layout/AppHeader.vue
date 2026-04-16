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
      <router-link v-if="auth.isEditor" to="/new" class="btn-primary">+ New Page</router-link>
      <router-link to="/profile">{{ auth.username }}</router-link>
      <router-link v-if="auth.isAdmin" to="/admin/users">Admin</router-link>
      <button class="btn-secondary" @click="logout">Logout</button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}
.logo { font-size: 20px; font-weight: 700; color: var(--color-text); text-decoration: none; }
.search-form { flex: 1; max-width: 400px; }
.search-form input { width: 100%; }
.header-nav { display: flex; align-items: center; gap: 12px; }
</style>
