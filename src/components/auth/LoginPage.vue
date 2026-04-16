<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')

async function onSubmit() {
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    router.push({ name: 'pages' })
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Login failed'
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

<style scoped>
.auth-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--color-bg-secondary); }
.auth-card { background: var(--color-bg); padding: 40px; border-radius: 8px; box-shadow: var(--shadow); width: 100%; max-width: 400px; }
.auth-card h1 { margin-bottom: 24px; }
.field { margin-bottom: 16px; }
.field label { display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500; }
.error { color: var(--color-danger); margin-bottom: 12px; font-size: 14px; }
button[type="submit"] { width: 100%; padding: 10px; }
.switch { margin-top: 16px; text-align: center; font-size: 14px; }
</style>
