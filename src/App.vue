<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Sidebar from './components/layout/Sidebar.vue';
import ToastNotification from './components/ToastNotification.vue';
import { authStore } from './store/auth';

const route = useRoute();
const router = useRouter();
const isUpdatePassword = computed(() => {
  return route.path.includes('update-password') || window.location.pathname.includes('update-password');
});

const showSidebar = computed(() => {
  return authStore.isAuthenticated && !isUpdatePassword.value;
});

function goToLogin() {
  authStore.sessionExpired = false;
  router.replace('/login');
}

// Bumping this key forces RouterView to fully remount the current view,
// restarting its data-loading composables with the fresh valid session.
const routerKey = ref(0);

function onAuthRecovered() {
  // Only remount if on a protected route (not login/update-password).
  if (route.meta?.requiresAuth) {
    routerKey.value++;
  }
}

onMounted(() => window.addEventListener('auth:recovered', onAuthRecovered));
onUnmounted(() => window.removeEventListener('auth:recovered', onAuthRecovered));
</script>

<template>
  <div class="app-layout" :data-recovery="isUpdatePassword">
    <Sidebar v-if="showSidebar" />
    <main class="main-content" :style="!showSidebar ? 'padding: 0;' : ''">
      <RouterView :key="routerKey" />
    </main>
    <ToastNotification />

    <div v-if="authStore.sessionExpired" class="session-expired-overlay">
      <div class="session-expired-card">
        <span class="session-expired-icon">🔒</span>
        <h2>Sesión expirada</h2>
        <p>Tu sesión ha caducado. Por favor, inicia sesión de nuevo.</p>
        <button class="session-expired-btn" @click="goToLogin">Iniciar sesión</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  background-color: transparent;
}

@media (max-width: 768px) {
  .main-content {
    padding-top: 5rem;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

.session-expired-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.session-expired-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  text-align: center;
  max-width: 360px;
  width: 90%;
}

.session-expired-icon {
  font-size: 2.5rem;
}

.session-expired-card h2 {
  color: #e3ff04;
  margin: 0.75rem 0 0.5rem;
  font-size: 1.25rem;
}

.session-expired-card p {
  color: #aaa;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.session-expired-btn {
  background: #e3ff04;
  color: #000;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.5rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.session-expired-btn:hover {
  opacity: 0.85;
}
</style>
