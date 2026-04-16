import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupErrorHandler } from './utils/errorHandler'
import './assets/main.css'

const app = createApp(App)
setupErrorHandler(app)
app.use(createPinia())
app.use(router)
app.mount('#app')
