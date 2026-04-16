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
      <router-link v-if="auth.isEditor" to="/new" class="btn-primary new-page-btn">+ New Page</router-link>
      <router-link to="/profile" class="nav-link">{{ auth.username }}</router-link>
      <router-link v-if="auth.isAdmin" to="/admin/users" class="nav-link">Admin</router-link>
      <button class="btn-secondary logout-btn" @click="logout">Logout</button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 28px;
  height: 60px;
  background: #1e1e1e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  position: relative;
  z-index: 10;
}

.logo {
  font-family: var(--font-heading);
  font-style: italic;
  font-size: 22px;
  font-weight: 700;
  color: #f2efe9;
  text-decoration: none;
  letter-spacing: -0.5px;
  transition: color 0.2s ease;
}

.logo:hover {
  color: #fff;
  text-decoration: none;
}

.search-form {
  flex: 1;
  max-width: 420px;
}

.search-form input {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius);
  color: #e8e4de;
  padding: 8px 14px;
  font-size: 14px;
  font-family: var(--font-body);
  transition: all 0.2s ease;
}

.search-form input::placeholder {
  color: rgba(196, 191, 182, 0.6);
}

.search-form input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26, 107, 90, 0.25);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.nav-link {
  color: #c4bfb6;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: #f2efe9;
  text-decoration: none;
}

.new-page-btn {
  font-size: 13px;
  padding: 6px 14px;
  text-decoration: none;
}

.logout-btn {
  color: #c4bfb6;
  border-color: rgba(255, 255, 255, 0.12);
  font-size: 13px;
  padding: 6px 14px;
}

.logout-btn:hover {
  color: #f2efe9;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
