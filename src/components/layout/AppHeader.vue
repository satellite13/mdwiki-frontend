<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const auth = useAuthStore()
const themeStore = useThemeStore()
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
      <router-link to="/attachments" class="nav-link">Attachments</router-link>
      <router-link to="/profile" class="nav-link">{{ auth.username }}</router-link>
      <router-link v-if="auth.isAdmin" to="/admin/users" class="nav-link">Admin</router-link>
      <button class="theme-toggle" @click="themeStore.toggle()" :title="themeStore.isDark ? 'Switch to light' : 'Switch to dark'">
        <svg v-if="themeStore.isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
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

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.theme-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}
</style>
