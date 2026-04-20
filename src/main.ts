import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { initAuth, authStore } from './store/auth'
import { initRealtime } from './store/notifications'

// After a new deploy the old chunk hashes no longer exist on the server.
// Two failure modes on Firebase SPA hosting:
//   • text/html  → Firebase serves index.html as fallback (MIME error)
//   • 404        → chunk simply doesn't exist (Firebase returns non-OK, often no body)
// We reload on either. Only genuine network errors (fetch throws) are left alone.
router.onError(async (err) => {
  if (!/Failed to fetch dynamically imported module|Loading chunk/.test(err.message)) return;
  try {
    const urlMatch = err.message.match(/https?:\/\/\S+\.js/);
    if (!urlMatch) { window.location.reload(); return; }
    const res = await fetch(urlMatch[0], { method: 'HEAD' });
    const ct  = res.headers.get('Content-Type') ?? '';
    if (!res.ok || ct.includes('text/html')) window.location.reload();
  } catch { /* truly offline — don't reload to avoid loop */ }
});

initAuth().then(() => {
  createApp(App).use(router).mount('#app');
  if (authStore.isAuthenticated && authStore.role === 'ADMIN') {
    initRealtime();
  }
})
