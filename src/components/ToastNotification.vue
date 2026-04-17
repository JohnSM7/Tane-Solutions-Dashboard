<script setup lang="ts">
import { useToast } from '../composables/useToast';
const { toasts, remove } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.type"
          @click="remove(t.id)"
        >
          <span class="toast-icon">
            <template v-if="t.type === 'success'">✓</template>
            <template v-else-if="t.type === 'error'">✕</template>
            <template v-else-if="t.type === 'warning'">!</template>
            <template v-else>i</template>
          </span>
          <span class="toast-msg">{{ t.message }}</span>
          <button class="toast-close" @click.stop="remove(t.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  pointer-events: none;
  max-width: 380px;
  width: calc(100vw - 3rem);
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  pointer-events: all;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: opacity 0.2s;
}
.toast:hover { opacity: 0.9; }

.toast.success {
  background: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.4);
  color: #4ade80;
}
.toast.error {
  background: rgba(255, 68, 68, 0.15);
  border-color: rgba(255, 68, 68, 0.4);
  color: #f87171;
}
.toast.warning {
  background: rgba(255, 165, 0, 0.15);
  border-color: rgba(255, 165, 0, 0.4);
  color: #ffa500;
}
.toast.info {
  background: rgba(227, 255, 4, 0.12);
  border-color: rgba(227, 255, 4, 0.35);
  color: #e3ff04;
}

.toast-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 800;
  flex-shrink: 0;
}

.toast-msg { flex: 1; color: #e5e7eb; }

.toast-close {
  background: transparent;
  border: none;
  color: currentColor;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.6;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.toast-close:hover { opacity: 1; }

/* Animations */
.toast-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from  { opacity: 0; transform: translateX(60px); }
.toast-leave-to    { opacity: 0; transform: translateX(60px); }
.toast-move        { transition: transform 0.3s ease; }
</style>
