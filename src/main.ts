import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupErrorHandler } from './utils/errorHandler'
import { readString } from './utils/localPreferences'
import 'material-symbols/outlined.css'
import './assets/main.css'

const app = createApp(App)
setupErrorHandler(app)
app.use(createPinia())
app.use(router)
if (readString('theme') === 'dark') {
  document.documentElement.dataset.theme = 'dark'
}

app.mount('#app')
