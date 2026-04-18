<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <div class="dashboard-card">
    <div v-if="title" class="card-header">
      <h3>{{ title }}</h3>
      <slot name="actions"></slot>
    </div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.dashboard-card {
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px; /* Smooth corners */
  padding: 1.5rem;
  transition: border-color 0.3s ease;
}

.dashboard-card:hover {
  border-color: rgba(227, 255, 4, 0.3); /* Subtle green glow on hover */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.card-header h3 {
  font-size: 1.1rem;
  color: var(--color-text-light);
  font-weight: 600;
}
</style>
