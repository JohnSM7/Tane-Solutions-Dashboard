import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { initAuth } from './store/auth'

initAuth().then(() => {
  createApp(App).use(router).mount('#app')
})
