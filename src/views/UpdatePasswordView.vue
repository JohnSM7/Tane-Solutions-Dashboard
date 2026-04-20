<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';

const password = ref('');
const confirmPassword = ref('');
const errorMsg = ref('');
const successMsg = ref('');
const isLoading = ref(false);
const isVerifying = ref(true);

onMounted(async () => {
  // Give Supabase a moment to process the hash from the URL
  setTimeout(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      errorMsg.value = 'No se ha encontrado una sesión de recuperación válida. Por favor, solicita un nuevo enlace desde la pantalla de login.';
    }
    isVerifying.value = false;
  }, 1000);
});

const handleUpdatePassword = async () => {
  errorMsg.value = '';
  successMsg.value = '';

  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Las contraseñas no coinciden.';
    return;
  }

  if (password.value.length < 6) {
    errorMsg.value = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }

  isLoading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({ 
      password: password.value 
    });
    if (error) throw error;
    
    successMsg.value = 'Tu contraseña ha sido actualizada con éxito. Redirigiendo al acceso...';

    // Leer el rol directamente de la DB antes de cerrar sesión
    // (authStore.role puede ser null si el perfil aún no cargó)
    let loginUrl = '/login';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', session.user.id)
          .single();
        if (perfil?.rol === 'CLIENT') loginUrl = '/login-cliente';
      }
    } catch { /* si falla, redirige al dashboard por defecto */ }

    // Invalidar la sesión de recuperación
    await supabase.auth.signOut();

    setTimeout(() => {
      window.location.href = loginUrl;
    }, 2500);
  } catch (e: any) {
    errorMsg.value = `Error: ${e.message}`;
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="brand-header">
        <img src="/logo-verde.png" alt="Tane Solutions" class="login-logo" />
        <h1>Nueva Contraseña</h1>
        <p>Establece tu nueva clave de acceso</p>
      </div>

      <div v-if="isVerifying" class="verifying-state">
        <p>Verificando sesión de seguridad...</p>
      </div>

      <form v-else @submit.prevent="handleUpdatePassword" class="login-form">
        <div class="form-group">
          <label>Nueva Contraseña</label>
          <input 
            type="password" 
            v-model="password" 
            placeholder="••••••••" 
            required 
            class="form-input" 
            :disabled="isLoading" 
          />
        </div>

        <div class="form-group">
          <label>Confirmar Contraseña</label>
          <input 
            type="password" 
            v-model="confirmPassword" 
            placeholder="••••••••" 
            required 
            class="form-input" 
            :disabled="isLoading" 
          />
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

        <button type="submit" class="btn-primary login-btn" :disabled="isLoading">
          {{ isLoading ? 'Actualizando...' : 'Cambiar Contraseña' }}
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
  font-size: 0.95rem;
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

.error-msg {
  color: #f87171;
  font-size: 0.85rem;
  text-align: left;
  margin: 0;
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

.verifying-state {
  text-align: center;
  padding: 2rem 0;
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
