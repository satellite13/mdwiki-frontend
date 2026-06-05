<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useFolderStore } from '@/stores/folders'
import { useDialogStore } from '@/stores/dialog'
import { useEditorUiStore } from '@/stores/editorUi'
import { postWikiFullSync } from '@/api/sync'
import { getApiErrorMessage } from '@/utils/apiError'
import { t } from '@/utils/i18n'

const auth = useAuthStore()
const folderStore = useFolderStore()
const dialog = useDialogStore()
const themeStore = useThemeStore()
const editorUi = useEditorUiStore()
const { mobileNavOpen } = storeToRefs(editorUi)
const router = useRouter()
const route = useRoute()
const searchQuery = ref('')
const syncWikiLoading = ref(false)

async function onSyncWikiFromDisk() {
  const ok = await dialog.confirm(t.admin.syncWikiConfirm, {
    title: t.admin.syncWikiTitle,
    confirmLabel: t.admin.syncWikiButton
  })
  if (!ok) return
  syncWikiLoading.value = true
  try {
    const { data } = await postWikiFullSync()
    await folderStore.fetchTree(true)
    await dialog.alert(t.admin.syncWikiDone(data.added, data.updated, data.removed))
  } catch (e) {
    await dialog.alert(getApiErrorMessage(e, t.admin.syncWikiFailed))
  } finally {
    syncWikiLoading.value = false
  }
}

const graphLinkTo = computed(() => {
  if (route.name === 'page' && typeof route.params.slug === 'string' && route.params.slug.length > 0) {
    return { name: 'wiki-graph', query: { highlight: route.params.slug } }
  }
  return { name: 'wiki-graph' }
})

function onSearch() {
  if (searchQuery.value.trim()) {
    editorUi.closeMobileOverlays()
    router.push({ name: 'search', query: { q: searchQuery.value } })
  }
}

function logout() {
  editorUi.closeMobileOverlays()
  auth.logout()
  router.push({ name: 'login' })
}

function onNavClick() {
  editorUi.closeMobileOverlays()
}
</script>

<template>
  <header class="app-header">
    <button
      type="button"
      class="icon-btn sidebar-toggle show-mobile-only"
      aria-label="Open documents"
      @click="editorUi.toggleMobileSidebar()"
    >
      <span class="material-symbols-outlined notranslate" translate="no">menu</span>
    </button>

    <router-link to="/" class="logo" @click="onNavClick">MDWiki</router-link>

    <form class="search-form" @submit.prevent="onSearch">
      <input v-model="searchQuery" placeholder="Search pages..." type="search" />
    </form>

    <nav class="header-nav hide-mobile" aria-label="Main navigation">
      <router-link :to="graphLinkTo" class="nav-link" title="All pages and links in the wiki" @click="onNavClick">Graph</router-link>
      <router-link to="/attachments" class="nav-link" @click="onNavClick">Attachments</router-link>
      <router-link to="/profile" class="nav-link" @click="onNavClick">{{ auth.username }}</router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin/users"
        class="nav-link"
        :class="{ 'is-active': route.path.startsWith('/admin') }"
        @click="onNavClick"
      >
        Admin
      </router-link>
      <button
        v-if="auth.isAdmin"
        type="button"
        class="sync-disk-btn hide-narrow"
        :disabled="syncWikiLoading"
        :title="t.admin.syncWikiTitle"
        @click="onSyncWikiFromDisk"
      >
        {{ syncWikiLoading ? '…' : t.admin.syncWikiButton }}
      </button>
      <button class="theme-toggle" @click="themeStore.toggle()" :title="themeStore.isDark ? 'Switch to light' : 'Switch to dark'">
        <svg v-if="themeStore.isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button class="btn-secondary logout-btn hide-narrow" @click="logout">Logout</button>
    </nav>

    <div class="header-actions-mobile show-mobile-only">
      <button class="theme-toggle" @click="themeStore.toggle()" :title="themeStore.isDark ? 'Switch to light' : 'Switch to dark'">
        <svg v-if="themeStore.isDark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button
        type="button"
        class="icon-btn"
        aria-label="Navigation menu"
        :aria-expanded="mobileNavOpen"
        @click="editorUi.toggleMobileNav()"
      >
        <span class="material-symbols-outlined notranslate" translate="no">more_vert</span>
      </button>
    </div>

    <nav
      v-if="mobileNavOpen"
      class="mobile-nav-menu show-mobile-only"
      aria-label="Mobile navigation"
    >
      <router-link :to="graphLinkTo" class="mobile-nav-link" @click="onNavClick">Graph</router-link>
      <router-link to="/attachments" class="mobile-nav-link" @click="onNavClick">Attachments</router-link>
      <router-link to="/profile" class="mobile-nav-link" @click="onNavClick">{{ auth.username }}</router-link>
      <router-link
        v-if="auth.isAdmin"
        to="/admin/users"
        class="mobile-nav-link"
        @click="onNavClick"
      >
        Admin
      </router-link>
      <button
        v-if="auth.isAdmin"
        type="button"
        class="mobile-nav-link mobile-nav-btn"
        :disabled="syncWikiLoading"
        @click="onSyncWikiFromDisk(); onNavClick()"
      >
        {{ syncWikiLoading ? '…' : t.admin.syncWikiButton }}
      </button>
      <button type="button" class="mobile-nav-link mobile-nav-btn mobile-nav-logout" @click="logout">
        Logout
      </button>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 16px;
  height: var(--app-header-height);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  position: relative;
  z-index: 110;
}

.logo {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.3px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.logo:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.search-form {
  flex: 1;
  min-width: 0;
  max-width: 360px;
}

.search-form input {
  width: 100%;
  font-size: 13px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius);
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-shrink: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.nav-link:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-bg-hover);
  text-decoration: none;
}

.nav-link.router-link-active,
.nav-link.is-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.icon-btn,
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.icon-btn:hover,
.theme-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.icon-btn .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}

.sync-disk-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.sync-disk-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-hover);
  border-color: var(--color-text-faint);
}

.sync-disk-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.header-actions-mobile {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.mobile-nav-menu {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0 10px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}

.mobile-nav-link {
  display: block;
  width: 100%;
  padding: 10px 4px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;
}

.mobile-nav-link:hover {
  background: var(--color-bg-hover);
  text-decoration: none;
}

.mobile-nav-btn {
  font-family: inherit;
}

.mobile-nav-logout {
  color: var(--color-danger);
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 12px;
    gap: 8px;
    height: auto;
    min-height: var(--app-header-height);
  }

  .search-form {
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .app-header {
    padding: 0 14px;
    gap: 12px;
  }

  .search-form {
    max-width: 280px;
  }

  .nav-link {
    padding: 0 8px;
    font-size: 11px;
  }
}
</style>
