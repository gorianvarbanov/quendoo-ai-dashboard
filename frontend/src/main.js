import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './router'
import { registerServiceWorker, setupInstallPrompt } from './utils/pwa'
import { lazyLoad } from './directives/lazyLoad'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

// Register global directives
app.directive('lazy-load', lazyLoad)

app.use(pinia)
app.use(vuetify)
app.use(router)
app.mount('#app')

// Register PWA service worker
if (import.meta.env.PROD) {
  registerServiceWorker()
  setupInstallPrompt()

  console.log('[PWA] Progressive Web App features enabled')
}
