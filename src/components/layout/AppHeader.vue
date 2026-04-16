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
  background: #262626;
  border-bottom: 1px solid #3a3a3a;
  position: relative;
  z-index: 10;
}

.logo {
  font-family: var(--font-body);
  font-size: 22px;
  font-weight: 600;
  color: #dcddde;
  text-decoration: none;
  letter-spacing: -0.5px;
  transition: color 0.15s ease;
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
  background: #2d2d2d;
  border: 1px solid #3a3a3a;
  border-radius: var(--radius);
  color: #dcddde;
  padding: 8px 14px;
  font-size: 14px;
  font-family: var(--font-body);
  transition: all 0.15s ease;
}

.search-form input::placeholder {
  color: #666666;
}

.search-form input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.nav-link {
  color: #999999;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: #dcddde;
  text-decoration: none;
}

.new-page-btn {
  font-size: 13px;
  padding: 6px 14px;
  text-decoration: none;
}

.logout-btn {
  color: #999999;
  border-color: #3a3a3a;
  font-size: 13px;
  padding: 6px 14px;
}

.logout-btn:hover {
  color: #dcddde;
  background: #333333;
  border-color: #555;
}
</style>
