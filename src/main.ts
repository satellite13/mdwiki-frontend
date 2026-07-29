import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { setupAuthGuard } from './api/authGuard'
import { setupErrorHandler } from './utils/errorHandler'
import { readString } from './utils/localPreferences'
import 'material-symbols/outlined.css'
import './assets/main.css'

const app = createApp(App)
setupErrorHandler(app)
app.use(createPinia())
app.use(router)
app.use(i18n)
setupAuthGuard()
if (readString('theme') === 'dark') {
  document.documentElement.dataset.theme = 'dark'
}

app.mount('#app')
