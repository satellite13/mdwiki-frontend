import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupErrorHandler } from './utils/errorHandler'
import 'material-symbols/outlined.css'
import './assets/main.css'

const app = createApp(App)
setupErrorHandler(app)
app.use(createPinia())
app.use(router)
// Apply saved theme before mount to prevent flash
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
  document.documentElement.dataset.theme = 'dark'
}

app.mount('#app')
