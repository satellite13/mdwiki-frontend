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

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--color-bg-secondary);
  background-image:
    url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
}

.auth-card {
  background: var(--color-bg);
  padding: 48px 44px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--color-border);
  animation: fadeInUp 0.5s ease both;
}

.auth-card h1 {
  font-family: var(--font-heading);
  text-align: center;
  margin-bottom: 4px;
  font-size: 1.6rem;
}

.ornament-rule {
  text-align: center;
  color: var(--color-border);
  font-size: 13px;
  letter-spacing: 4px;
  margin-bottom: 28px;
  font-family: var(--font-body);
}

.field {
  margin-bottom: 18px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
  margin-bottom: 12px;
  font-size: 14px;
}

button[type="submit"] {
  width: 100%;
  padding: 12px;
  font-size: 15px;
}

.switch {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
