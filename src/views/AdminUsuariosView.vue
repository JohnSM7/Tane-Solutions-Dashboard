<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import { useClientsList } from '../services/clients';
import { supabase } from '../supabase';
import {
  useUsuariosAdmin, crearUsuario, eliminarUsuario, enviarResetPassword,
  actualizarPerfilUsuario, actualizarEmailUsuario,
  type UsuarioCompleto,
} from '../services/adminUsuarios';

const { usuarios, loading, loadingMeta } = useUsuariosAdmin();
const { clients } = useClientsList();

// ── Filtros ────────────────────────────────────────────────────────────────────
const filtroRol = ref<'TODOS' | 'ADMIN' | 'CLIENT'>('TODOS');
const filtroTexto = ref('');

const usuariosFiltrados = computed(() => {
  let lista = usuarios.value;
  if (filtroRol.value !== 'TODOS') lista = lista.filter(u => u.rol === filtroRol.value);
  if (filtroTexto.value.trim()) {
    const q = filtroTexto.value.toLowerCase();
    lista = lista.filter(u =>
      u.nombre.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.clientes?.nombre?.toLowerCase().includes(q)
    );
  }
  return lista;
});

const totalAdmin  = computed(() => usuarios.value.filter(u => u.rol === 'ADMIN').length);
const totalClient = computed(() => usuarios.value.filter(u => u.rol === 'CLIENT').length);

// ── Modal Crear ────────────────────────────────────────────────────────────────
const showCrearModal = ref(false);
const creando = ref(false);
const crearError = ref('');
const crearForm = ref({
  email: '', password: '', nombre: '',
  rol: 'ADMIN' as 'ADMIN' | 'CLIENT',
  cliente_id: null as string | null,
  horas_disponibles_semana: 40,
});

const resetCrearForm = () => {
  crearForm.value = { email: '', password: '', nombre: '', rol: 'ADMIN', cliente_id: null, horas_disponibles_semana: 40 };
  crearError.value = '';
};

const handleCrear = async () => {
  crearError.value = '';
  creando.value = true;
  try {
    const nuevo = await crearUsuario({
      ...crearForm.value,
      cliente_id: crearForm.value.rol === 'CLIENT' ? crearForm.value.cliente_id : null,
      horas_disponibles_semana: crearForm.value.rol === 'ADMIN' ? crearForm.value.horas_disponibles_semana : 40,
    });
    usuarios.value.push(nuevo);

    // Enviar email de bienvenida con credenciales
    supabase.functions.invoke('send-email', { body: {
      type: 'welcome',
      nombre: crearForm.value.nombre,
      email: crearForm.value.email,
      password: crearForm.value.password,
      rol: crearForm.value.rol,
      loginUrl: crearForm.value.rol === 'CLIENT'
        ? `${window.location.origin.replace('dashboard', 'clientes')}/login-cliente`
        : `${window.location.origin}/login`,
    }}).catch(console.warn);

    showCrearModal.value = false;
    resetCrearForm();
  } catch (e: any) {
    crearError.value = e?.message ?? 'Error al crear el usuario';
  } finally { creando.value = false; }
};

// ── Modal Editar ───────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editando = ref(false);
const editError = ref('');
const editForm = ref<UsuarioCompleto & { newEmail: string }>({
  id: '', nombre: '', rol: 'ADMIN', cliente_id: null,
  horas_disponibles_semana: 40, newEmail: '',
});

const openEdit = (u: UsuarioCompleto) => {
  editForm.value = { ...u, newEmail: u.email ?? '' };
  editError.value = '';
  showEditModal.value = true;
};

const handleEditar = async () => {
  editError.value = '';
  editando.value = true;
  try {
    const updates: any = {
      nombre: editForm.value.nombre,
      rol: editForm.value.rol,
      cliente_id: editForm.value.rol === 'CLIENT' ? editForm.value.cliente_id : null,
      horas_disponibles_semana: editForm.value.horas_disponibles_semana,
    };
    const updated = await actualizarPerfilUsuario(editForm.value.id, updates);

    // Cambio de email solo si fue modificado
    if (editForm.value.newEmail && editForm.value.newEmail !== editForm.value.email) {
      await actualizarEmailUsuario(editForm.value.id, editForm.value.newEmail);
      updated.email = editForm.value.newEmail;
    }

    const idx = usuarios.value.findIndex(u => u.id === editForm.value.id);
    if (idx !== -1) {
      usuarios.value[idx] = {
        ...usuarios.value[idx],
        ...updated,
        email: editForm.value.newEmail || usuarios.value[idx]?.email,
      };
    }
    showEditModal.value = false;
  } catch (e: any) {
    editError.value = e?.message ?? 'Error al guardar cambios';
  } finally { editando.value = false; }
};

// ── Eliminar ───────────────────────────────────────────────────────────────────
const eliminando = ref<string | null>(null);

const handleEliminar = async (u: UsuarioCompleto) => {
  if (!confirm(`¿Eliminar a "${u.nombre}" (${u.email ?? u.id})?\n\nEsta acción es irreversible y eliminará su acceso a la plataforma.`)) return;
  eliminando.value = u.id;
  try {
    await eliminarUsuario(u.id);
    usuarios.value = usuarios.value.filter(x => x.id !== u.id);
  } catch (e: any) {
    alert(`Error al eliminar: ${e.message}`);
  } finally { eliminando.value = null; }
};

// ── Reset password ─────────────────────────────────────────────────────────────
const enviando = ref<string | null>(null);
const enviado  = ref<string | null>(null);

const handleReset = async (u: UsuarioCompleto) => {
  if (!u.email) return alert('Este usuario no tiene email registrado.');
  enviando.value = u.id;
  try {
    await enviarResetPassword(u.email);
    enviado.value = u.id;
    setTimeout(() => { if (enviado.value === u.id) enviado.value = null; }, 3000);
  } catch (e: any) {
    alert(`Error: ${e.message}`);
  } finally { enviando.value = null; }
};

// ── Utils ──────────────────────────────────────────────────────────────────────
const timeSince = (d?: string | null) => {
  if (!d) return 'Nunca';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`;
};
</script>

<template>
  <div class="view-container">
    <div class="header">
      <div>
        <h1>Gestión de Usuarios</h1>
        <span class="subtitle">Altas, bajas y accesos a la plataforma</span>
      </div>
      <button class="btn-primary" @click="showCrearModal = true">+ Nuevo Usuario</button>
    </div>

    <!-- KPIs -->
    <div class="kpi-row">
      <DashboardCard>
        <div class="kpi-mini">
          <span class="kpi-label">Total usuarios</span>
          <span class="kpi-val">{{ usuarios.length }}</span>
        </div>
      </DashboardCard>
      <DashboardCard>
        <div class="kpi-mini">
          <span class="kpi-label">Administradores</span>
          <span class="kpi-val" style="color:var(--color-primary)">{{ totalAdmin }}</span>
        </div>
      </DashboardCard>
      <DashboardCard>
        <div class="kpi-mini">
          <span class="kpi-label">Clientes con acceso</span>
          <span class="kpi-val" style="color:#60a5fa">{{ totalClient }}</span>
        </div>
      </DashboardCard>
    </div>

    <DashboardCard>
      <!-- Filtros -->
      <div class="filters-row">
        <input
          v-model="filtroTexto"
          class="search-input"
          placeholder="Buscar por nombre, email o empresa..."
        />
        <div class="rol-tabs">
          <button
            v-for="tab in ['TODOS', 'ADMIN', 'CLIENT']"
            :key="tab"
            class="tab-btn"
            :class="{ active: filtroRol === tab }"
            @click="filtroRol = tab as any"
          >{{ tab === 'TODOS' ? 'Todos' : tab === 'ADMIN' ? 'Admins' : 'Clientes' }}</button>
        </div>
      </div>

      <div v-if="loading" class="loading-state">Cargando usuarios...</div>

      <template v-else>
        <div v-if="usuariosFiltrados.length === 0" class="empty-state">
          No hay usuarios que coincidan con el filtro.
        </div>

        <div v-else class="users-table">
          <!-- Cabecera -->
          <div class="table-header">
            <span>Usuario</span>
            <span>Rol / Empresa</span>
            <span class="ta-c">Último acceso</span>
            <span class="ta-c">Estado</span>
            <span class="ta-r">Acciones</span>
          </div>

          <!-- Filas -->
          <div
            v-for="u in usuariosFiltrados"
            :key="u.id"
            class="table-row"
          >
            <!-- Avatar + nombre + email -->
            <div class="user-cell">
              <div class="avatar" :class="u.rol.toLowerCase()">
                {{ u.nombre.charAt(0).toUpperCase() }}
              </div>
              <div class="user-info">
                <span class="user-name">{{ u.nombre }}</span>
                <span class="user-email">
                  {{ loadingMeta ? '…' : (u.email ?? 'Sin email') }}
                </span>
              </div>
            </div>

            <!-- Rol + empresa cliente -->
            <div class="role-cell">
              <span class="rol-badge" :class="u.rol.toLowerCase()">{{ u.rol }}</span>
              <span v-if="u.clientes?.nombre" class="client-name">{{ u.clientes.nombre }}</span>
              <span v-else-if="u.rol === 'ADMIN'" class="client-name muted">{{ u.horas_disponibles_semana }}h/sem</span>
            </div>

            <!-- Último acceso -->
            <div class="ta-c access-cell">
              <span :class="{ 'muted': !u.last_sign_in_at }">
                {{ timeSince(u.last_sign_in_at) }}
              </span>
            </div>

            <!-- Estado confirmación -->
            <div class="ta-c status-cell">
              <span
                class="status-pill"
                :class="u.email_confirmed_at ? 'confirmed' : 'pending'"
              >
                {{ u.email_confirmed_at ? 'Activo' : 'Pendiente' }}
              </span>
            </div>

            <!-- Acciones -->
            <div class="actions-cell">
              <!-- Reenviar acceso -->
              <button
                class="action-btn"
                :class="{ sent: enviado === u.id }"
                :disabled="enviando === u.id"
                @click="handleReset(u)"
                :title="enviado === u.id ? 'Enviado' : 'Reenviar enlace de acceso'"
              >
                {{ enviado === u.id ? '✓' : enviando === u.id ? '…' : '📧' }}
              </button>

              <!-- Editar -->
              <button class="action-btn" @click="openEdit(u)" title="Editar usuario">
                ✏️
              </button>

              <!-- Eliminar -->
              <button
                class="action-btn danger"
                :disabled="eliminando === u.id"
                @click="handleEliminar(u)"
                title="Eliminar usuario"
              >
                {{ eliminando === u.id ? '…' : '🗑️' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </DashboardCard>
  </div>

  <!-- ── Modal: Crear Usuario ─────────────────────────────────────────────────── -->
  <div class="modal-overlay" v-if="showCrearModal" @click.self="showCrearModal = false; resetCrearForm()">
    <div class="modal-box">
      <p class="modal-title">Nuevo Usuario</p>

      <div class="form-row">
        <div class="form-group">
          <label>Nombre completo *</label>
          <input v-model="crearForm.nombre" class="form-input" placeholder="Ana García" />
        </div>
        <div class="form-group">
          <label>Rol *</label>
          <select v-model="crearForm.rol" class="form-input">
            <option value="ADMIN">Admin (agencia)</option>
            <option value="CLIENT">Cliente</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Email *</label>
        <input v-model="crearForm.email" type="email" class="form-input" placeholder="usuario@email.com" />
      </div>

      <div class="form-group">
        <label>Contraseña temporal *</label>
        <input v-model="crearForm.password" type="password" class="form-input" placeholder="Mínimo 6 caracteres" />
        <span class="field-hint">El usuario podrá cambiarla desde su perfil. Recomiéndale usar "¿Olvidaste tu contraseña?" al primer acceso.</span>
      </div>

      <template v-if="crearForm.rol === 'CLIENT'">
        <div class="form-group">
          <label>Empresa cliente vinculada</label>
          <select v-model="crearForm.cliente_id" class="form-input">
            <option :value="null">— Sin vincular —</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </template>

      <template v-if="crearForm.rol === 'ADMIN'">
        <div class="form-group">
          <label>Horas disponibles / semana</label>
          <input v-model.number="crearForm.horas_disponibles_semana" type="number" min="1" max="60" class="form-input" />
        </div>
      </template>

      <p v-if="crearError" class="error-msg">{{ crearError }}</p>

      <div class="modal-actions">
        <button class="btn-text" @click="showCrearModal = false; resetCrearForm()">Cancelar</button>
        <button
          class="btn-primary"
          @click="handleCrear"
          :disabled="creando || !crearForm.email || !crearForm.password || !crearForm.nombre"
        >
          {{ creando ? 'Creando...' : 'Crear Usuario' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Editar Usuario ────────────────────────────────────────────────── -->
  <div class="modal-overlay" v-if="showEditModal" @click.self="showEditModal = false">
    <div class="modal-box">
      <p class="modal-title">Editar Usuario</p>

      <div class="form-row">
        <div class="form-group">
          <label>Nombre completo</label>
          <input v-model="editForm.nombre" class="form-input" />
        </div>
        <div class="form-group">
          <label>Rol</label>
          <select v-model="editForm.rol" class="form-input">
            <option value="ADMIN">Admin</option>
            <option value="CLIENT">Cliente</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Email</label>
        <input v-model="editForm.newEmail" type="email" class="form-input" />
        <span v-if="editForm.newEmail !== editForm.email" class="field-hint warning">
          El email de acceso cambiará a este valor.
        </span>
      </div>

      <template v-if="editForm.rol === 'CLIENT'">
        <div class="form-group">
          <label>Empresa cliente vinculada</label>
          <select v-model="editForm.cliente_id" class="form-input">
            <option :value="null">— Sin vincular —</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </template>

      <template v-if="editForm.rol === 'ADMIN'">
        <div class="form-group">
          <label>Horas disponibles / semana</label>
          <input v-model.number="editForm.horas_disponibles_semana" type="number" min="1" max="60" class="form-input" />
        </div>
      </template>

      <p v-if="editError" class="error-msg">{{ editError }}</p>

      <div class="modal-actions">
        <button class="btn-text" @click="showEditModal = false">Cancelar</button>
        <button class="btn-primary" @click="handleEditar" :disabled="editando || !editForm.nombre">
          {{ editando ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
.header h1 { font-size: 1.8rem; margin-bottom: 0.3rem; }
.subtitle { color: var(--color-text-muted); font-size: 0.95rem; }

.kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.kpi-mini { display: flex; flex-direction: column; gap: 0.3rem; }
.kpi-label { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; }
.kpi-val { font-size: 2rem; font-weight: 800; }

/* Filtros */
.filters-row {
  display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.search-input {
  flex: 1; min-width: 200px;
  background: var(--color-bg-lighter); border: 1px solid var(--color-border);
  color: var(--color-text-light); padding: 0.55rem 0.9rem;
  border-radius: 6px; font-family: inherit; font-size: 0.9rem; outline: none;
}
.search-input:focus { border-color: var(--color-primary); }
.rol-tabs { display: flex; gap: 0.35rem; }
.tab-btn {
  background: transparent; border: 1px solid var(--color-border);
  color: var(--color-text-muted); padding: 0.4rem 0.85rem;
  border-radius: 20px; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;
}
.tab-btn.active, .tab-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.tab-btn.active { background: rgba(227,255,4,0.08); }

/* Tabla */
.users-table { display: flex; flex-direction: column; }
.table-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 120px 100px 120px;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.4px; color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 120px 100px 120px;
  gap: 0.5rem;
  padding: 0.75rem;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.1s;
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: rgba(255,255,255,0.02); }

/* User cell */
.user-cell { display: flex; align-items: center; gap: 0.75rem; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.9rem; flex-shrink: 0;
}
.avatar.admin  { background: rgba(227,255,4,0.15);  color: var(--color-primary); }
.avatar.client { background: rgba(96,165,250,0.15); color: #60a5fa; }
.user-info { display: flex; flex-direction: column; }
.user-name  { font-weight: 600; font-size: 0.9rem; }
.user-email { font-size: 0.78rem; color: var(--color-text-muted); }

/* Role cell */
.role-cell { display: flex; flex-direction: column; gap: 0.25rem; }
.rol-badge {
  display: inline-block; padding: 0.15rem 0.5rem;
  border-radius: 10px; font-size: 0.72rem; font-weight: 700;
  width: fit-content;
}
.rol-badge.admin  { background: rgba(227,255,4,0.1);  color: var(--color-primary); }
.rol-badge.client { background: rgba(96,165,250,0.1); color: #60a5fa; }
.client-name { font-size: 0.78rem; color: var(--color-text-muted); }

/* Status */
.status-pill {
  display: inline-block; padding: 0.15rem 0.6rem;
  border-radius: 10px; font-size: 0.75rem; font-weight: 600;
}
.status-pill.confirmed { background: rgba(74,222,128,0.12); color: #4ade80; }
.status-pill.pending   { background: rgba(255,165,0,0.12);  color: #ffa500; }

/* Actions */
.actions-cell { display: flex; align-items: center; justify-content: flex-end; gap: 0.3rem; }
.action-btn {
  background: transparent; border: none; cursor: pointer;
  font-size: 0.95rem; padding: 0.3rem 0.4rem; border-radius: 6px;
  transition: background 0.15s;
}
.action-btn:hover { background: rgba(255,255,255,0.08); }
.action-btn.danger:hover { background: rgba(255,68,68,0.15); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.sent { color: #4ade80; }

/* Misc */
.ta-c { text-align: center; }
.ta-r { text-align: right; }
.access-cell { font-size: 0.82rem; }
.muted { color: var(--color-text-muted); }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem; text-align: center; }
.empty-state   { color: var(--color-text-muted); text-align: center; padding: 2rem; font-style: italic; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 520px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.field-hint { font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.4; }
.field-hint.warning { color: #ffa500; }
.error-msg { color: #f87171; font-size: 0.85rem; margin: 0; }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background-color: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); }
  .table-header, .table-row { grid-template-columns: 1fr auto; }
  .table-header span:nth-child(2),
  .table-header span:nth-child(3),
  .table-header span:nth-child(4),
  .table-row .role-cell,
  .table-row .access-cell,
  .table-row .status-cell { display: none; }
  .form-row { flex-direction: column; }
}
</style>
