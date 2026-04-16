import type { App } from 'vue'

export function setupErrorHandler(app: App) {
  app.config.errorHandler = (err, _instance, info) => {
    console.error('Vue error:', err, '\nInfo:', info)
  }
}
