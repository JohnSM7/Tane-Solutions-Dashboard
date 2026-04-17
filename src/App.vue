<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/layout/Sidebar.vue';
import ToastNotification from './components/ToastNotification.vue';
import { authStore } from './store/auth';

const route = useRoute();
const isUpdatePassword = computed(() => {
  return route.path.includes('update-password') || window.location.pathname.includes('update-password');
});

const showSidebar = computed(() => {
  return authStore.isAuthenticated && !isUpdatePassword.value;
});
</script>

<template>
  <div class="app-layout" :data-recovery="isUpdatePassword">
    <Sidebar v-if="showSidebar" />
    <main class="main-content" :style="!showSidebar ? 'padding: 0;' : ''">
      <RouterView />
    </main>
    <ToastNotification />
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
    padding-top: 5rem; /* Space for mobile toggle */
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}
</style>
