<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getApiErrorMessage } from '@/utils/apiError'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')

async function onSubmit() {
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/'
    router.push(redirect)
  } catch (e: unknown) {
    error.value = getApiErrorMessage(e, t('errors.loginFailed'))
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Login</h1>

      <form @submit.prevent="onSubmit">
        <div class="field"><label>Username</label><input v-model="username" required autocomplete="username" /></div>
        <div class="field"><label>Password</label><input v-model="password" type="password" required autocomplete="current-password" /></div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn-primary">Login</button>
      </form>
      <p class="switch">Don't have an account? <router-link to="/register">Register</router-link></p>
    </div>
  </div>
</template>

