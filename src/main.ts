import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { initAuth, authStore } from './store/auth'
import { initRealtime } from './store/notifications'

initAuth().then(() => {
  createApp(App).use(router).mount('#app');
  if (authStore.isAuthenticated && authStore.role === 'ADMIN') {
    initRealtime();
  }
})
