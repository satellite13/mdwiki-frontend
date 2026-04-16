<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')

async function onSubmit() {
  error.value = ''
  try {
    await auth.register(username.value, email.value, password.value)
    router.push({ name: 'pages' })
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Registration failed'
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Register</h1>
      <div class="ornament-rule">--- * ---</div>
      <form @submit.prevent="onSubmit">
        <div class="field"><label>Username</label><input v-model="username" required autocomplete="username" /></div>
        <div class="field"><label>Email</label><input v-model="email" type="email" required autocomplete="email" /></div>
        <div class="field"><label>Password</label><input v-model="password" type="password" required minlength="8" autocomplete="new-password" /></div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn-primary">Register</button>
      </form>
      <p class="switch">Already have an account? <router-link to="/login">Login</router-link></p>
    </div>
  </div>
</template>

