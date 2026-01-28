<script setup lang="ts">
import Sidebar from './components/layout/Sidebar.vue';
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
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
  background-color: var(--color-bg-dark);
}

@media (max-width: 768px) {
  .main-content {
    padding-top: 5rem; /* Space for mobile toggle */
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}
</style>
