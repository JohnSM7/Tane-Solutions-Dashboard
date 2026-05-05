<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { login, logout, authStore } from '../store/auth';
import { supabase } from '../supabase';

const router = useRouter();

const email = ref('');
const password = ref('');
const errorMsg = ref('');
const successMsg = ref('');
const isLoading = ref(false);
const isRecoveryMode = ref(false);

// ── Protección contra fuerza bruta (client-side) ──────────────────────────────
const failedAttempts = ref(0);
const lockoutUntil = ref(0);
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutos

const isLockedOut = computed(() => Date.now() < lockoutUntil.value);
const lockoutSecondsLeft = computed(() =>
  isLockedOut.value ? Math.ceil((lockoutUntil.value - Date.now()) / 1000) : 0
);

const handleLogin = async () => {
  if (isLockedOut.value) return;
  errorMsg.value = '';
  successMsg.value = '';
  isLoading.value = true;
  try {
    await login(email.value, password.value);
    if (authStore.role === 'CLIENT') {
      await logout();
      errorMsg.value = 'Este área es exclusiva para administradores. Accede en clientes.tanesolutions.com';
      return;
    }
    failedAttempts.value = 0;
    router.push('/dashboard');
  } catch (e: any) {
    failedAttempts.value++;
    if (failedAttempts.value >= MAX_ATTEMPTS) {
      lockoutUntil.value = Date.now() + LOCKOUT_MS;
      failedAttempts.value = 0;
      errorMsg.value = `Demasiados intentos fallidos. Espera 5 minutos antes de volver a intentarlo.`;
    } else {
      const remaining = MAX_ATTEMPTS - failedAttempts.value;
      errorMsg.value = `Credenciales no válidas. ${remaining} intento(s) restante(s) antes del bloqueo temporal.`;
    }
  } finally {
    isLoading.value = false;
  }
};

const handleRecovery = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  if (!email.value) {
    errorMsg.value = 'Por favor, introduce tu correo electrónico.';
    return;
  }
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) throw error;
    successMsg.value = 'Se ha enviado un enlace de recuperación a tu correo.';
  } catch (e: any) {
    errorMsg.value = `Error: ${e.message}`;
  } finally {
    isLoading.value = false;
  }
};

const toggleMode = () => {
  isRecoveryMode.value = !isRecoveryMode.value;
  errorMsg.value = '';
  successMsg.value = '';
};
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="brand-header">
         <img src="/logo-verde.png" alt="Tane Solutions" class="login-logo" />
         <h1>Tane Solutions</h1>
         <p>{{ isRecoveryMode ? 'Restablecer contraseña' : 'Portal de Acceso' }}</p>
      </div>

      <form @submit.prevent="isRecoveryMode ? handleRecovery() : handleLogin()" class="login-form">
        <div class="form-group">
          <label>Correo Electrónico</label>
          <input type="email" v-model="email" placeholder="ejemplo@correo.com" required class="form-input" :disabled="isLoading" />
        </div>

        <div v-if="!isRecoveryMode" class="form-group">
          <div class="label-row">
            <label>Contraseña</label>
            <button type="button" class="btn-link" @click="toggleMode">¿La has olvidado?</button>
          </div>
          <input type="password" v-model="password" placeholder="••••••••" required class="form-input" :disabled="isLoading" />
        </div>

        <p v-if="isLockedOut" class="error-msg lockout-msg">
          Acceso bloqueado temporalmente. Inténtalo de nuevo en {{ lockoutSecondsLeft }}s.
        </p>
        <p v-else-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

        <button type="submit" class="btn-primary login-btn" :disabled="isLoading || isLockedOut">
          {{ isLoading ? 'Enviando...' : (isRecoveryMode ? 'Enviar enlace de recuperación' : 'Iniciar Sesión') }}
        </button>

        <button v-if="isRecoveryMode" type="button" class="btn-secondary" @click="toggleMode" :disabled="isLoading">
          Volver al Inicio de Sesión
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  background: transparent;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-card);
  padding: 2.5rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.brand-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}

.login-logo {
  width: 70px;
  height: 70px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.brand-header h1 {
  font-size: 1.5rem;
  margin: 0;
  color: var(--color-text-light);
}

.brand-header p {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 1rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-input {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-light);
  padding: 0.8rem 1rem;
  border-radius: 6px;
  font-family: inherit;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-primary);
}

.form-input:disabled {
  opacity: 0.5;
}

.error-msg {
  color: #f87171;
  font-size: 0.85rem;
  text-align: left;
  margin: 0;
}
.lockout-msg {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  font-weight: 600;
}

.success-msg {
  color: #4ade80;
  font-size: 0.82rem;
  text-align: left;
  margin: 0;
  line-height: 1.5;
}

.login-btn {
  background-color: var(--color-primary);
  color: #000;
  font-weight: 700;
  padding: 0.8rem;
  border-radius: 6px;
  margin-top: 0.5rem;
  font-size: 1rem;
}

.login-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  width: 100%;
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.setup-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.btn-setup {
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  padding: 0.6rem;
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-setup:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-setup:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
