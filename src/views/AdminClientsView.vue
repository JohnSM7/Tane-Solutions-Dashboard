<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import { useClientsList, createClient, deleteClient, healthColor, healthLabel } from '../services/clients';
import { crearUsuario } from '../services/adminUsuarios';
import { supabase } from '../supabase';

const router = useRouter();
const { clients, loading } = useClientsList();

const searchQuery = ref('');
const statusFilter = ref('');

const filteredClients = computed(() =>
  clients.value.filter(c => {
    const q = searchQuery.value.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) ||
      (c.contact ?? '').toLowerCase().includes(q) ||
      (c.contactEmail ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter.value || c.status === statusFilter.value;
    return matchSearch && matchStatus;
  })
);

// ── Modal añadir cliente ──────────────────────────────────────────────────────
const showModal = ref(false);
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

function showSuccess(msg: string) {
  successMsg.value = msg;
  setTimeout(() => { successMsg.value = ''; }, 4000);
}

const form = ref({
  name: '', contact: '', contactEmail: '', industry: '', status: 'Activo', logo: '',
  cif: '', direccionFacturacion: '',
});

const ITEMS_PREDEFINIDOS = [
  'Logo en alta resolución (SVG / PNG)',
  'Fotografías del negocio / producto',
  'Acceso a redes sociales (usuario + contraseña)',
  'Dominio y accesos de hosting',
  'Paleta de colores y tipografías',
  'Textos para las secciones (About, Servicios...)',
  'NIF / CIF para facturación',
  'Briefing del proyecto',
] as const;

const emailConfig = ref({
  enviar: false,
  mensaje: '',
  checklist: [] as string[],
  nuevoItem: '',
});

const toggleChecklistItem = (item: string) => {
  const idx = emailConfig.value.checklist.indexOf(item);
  if (idx === -1) emailConfig.value.checklist.push(item);
  else emailConfig.value.checklist.splice(idx, 1);
};

const addCustomItem = () => {
  const item = emailConfig.value.nuevoItem.trim();
  if (item && !emailConfig.value.checklist.includes(item)) {
    emailConfig.value.checklist.push(item);
  }
  emailConfig.value.nuevoItem = '';
};

// ── Autocomplete nombre empresa ───────────────────────────────────────────────
const showNameDropdown = ref(false);

const sugerenciasNombre = computed(() => {
  const q = (form.value.name ?? '').toLowerCase().trim();
  if (!q) return clients.value.map(c => c.name);
  return clients.value.map(c => c.name).filter(n => n.toLowerCase().includes(q));
});

const clienteYaExiste = computed(() =>
  clients.value.some(c => c.name.toLowerCase() === (form.value.name ?? '').toLowerCase().trim())
);

const seleccionarNombre = (nombre: string) => {
  form.value.name = nombre;
  showNameDropdown.value = false;
};

const hideNameDropdown = () => setTimeout(() => { showNameDropdown.value = false; }, 150);

const openModal = () => {
  form.value = { name: '', contact: '', contactEmail: '', industry: '', status: 'Activo', logo: '', cif: '', direccionFacturacion: '' };
  emailConfig.value = { enviar: false, mensaje: '', checklist: [], nuevoItem: '' };
  errorMsg.value = '';
  showNameDropdown.value = false;
  showModal.value = true;
};

const saveClient = async () => {
  errorMsg.value = '';
  if (clienteYaExiste.value) {
    errorMsg.value = 'Ya existe un cliente con ese nombre. Usa un nombre diferente o edita el existente.';
    return;
  }
  saving.value = true;
  try {
    const newClient = await createClient(form.value);
    clients.value.unshift({ ...newClient, financials: { paid: '0 €', pending: '0 €' }, healthScore: 100 });

    if (emailConfig.value.enviar && form.value.contactEmail) {
      // 1. Crear usuario en Supabase Auth vinculado al cliente
      let setupLink: string | null = null;
      try {
        const redirectTo = 'https://clientes.tanesolutions.com/update-password';
        const result = await crearUsuario({
          email: form.value.contactEmail,
          nombre: form.value.contact,
          rol: 'CLIENT',
          cliente_id: newClient.id,
          redirectTo,
        });
        setupLink = result.setupLink;
      } catch (userErr: any) {
        // Mostrar aviso pero no bloquear — el cliente ya está creado
        errorMsg.value = `Cliente creado, pero no se pudo crear el usuario: ${userErr.message}`;
        console.warn('[saveClient] crearUsuario falló:', userErr.message);
      }

      // 2. Enviar email de bienvenida con link de activación
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'welcome',
            nombre: form.value.contact,
            email: form.value.contactEmail,
            setupLink,
            loginUrl: 'https://clientes.tanesolutions.com/login-cliente',
            mensaje: emailConfig.value.mensaje,
            checklist: emailConfig.value.checklist,
          },
        });
        if (emailError) {
          console.warn('[send-email] error de red:', emailError.message);
          errorMsg.value = `Usuario creado. Email no enviado: ${emailError.message}`;
        } else if (emailData && !emailData.success) {
          const detail = emailData.error ?? JSON.stringify(emailData.details ?? '');
          console.warn('[send-email] Resend rechazó:', detail);
          errorMsg.value = `Usuario creado. Email no enviado: ${detail}`;
        }
      } catch (emailErr: any) {
        console.warn('[send-email] excepción:', emailErr.message);
      }
    }

    if (!errorMsg.value) {
      const emailEnviado = emailConfig.value.enviar && form.value.contactEmail;
      showModal.value = false;
      showSuccess(emailEnviado
        ? `✓ Cliente y usuario creados. Email de bienvenida enviado a ${form.value.contactEmail}`
        : `✓ Cliente creado correctamente`
      );
    }
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Error al guardar';
  } finally {
    saving.value = false;
  }
};

const viewProfile = (id: string) => router.push(`/clients/${id}`);

const confirmDeleteClient = async (c: typeof clients.value[0]) => {
  if (!confirm(`¿Eliminar "${c.name}"? Se eliminarán todos sus datos (sedes, documentos, facturas, proyectos).`)) return;
  await deleteClient(c.id);
  clients.value = clients.value.filter(x => x.id !== c.id);
};
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Clientes</h1>
      <span class="subtitle">Gestión Integral de Perfiles CRM</span>
    </div>

    <transition name="toast">
      <div v-if="successMsg" class="success-toast">{{ successMsg }}</div>
    </transition>

    <div class="filters-container">
      <input v-model="searchQuery" type="text" placeholder="Buscar por nombre o contacto..." class="search-input" />
      <select v-model="statusFilter" class="status-select">
        <option value="">Todos los estados</option>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
      </select>
      <button class="btn-primary" @click="openModal">+ Añadir Cliente</button>
    </div>

    <DashboardCard title="Directorio de Clientes">
      <div v-if="loading" class="loading-state">Cargando clientes...</div>
      <div v-else-if="filteredClients.length === 0" class="empty-state">
        No hay clientes que coincidan con la búsqueda.
      </div>
      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Contacto</th>
              <th>Cobrado</th>
              <th>Pendiente</th>
              <th>Salud</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in filteredClients" :key="client.id">
              <td data-label="Empresa">
                <div class="client-name-cell">
                  <strong>{{ client.name }}</strong>
                  <span class="client-industry">{{ client.industry }}</span>
                </div>
              </td>
              <td data-label="Contacto">
                <div class="client-name-cell">
                  <span>{{ client.contact }}</span>
                  <span class="client-industry">{{ client.contactEmail }}</span>
                </div>
              </td>
              <td data-label="Cobrado" class="text-success">{{ client.financials?.paid ?? '—' }}</td>
              <td data-label="Pendiente" class="text-warning">{{ client.financials?.pending ?? '—' }}</td>
              <td data-label="Salud">
                <div class="health-cell">
                  <div class="health-bar-bg">
                    <div class="health-bar" :style="{ width: client.healthScore + '%', background: healthColor(client.healthScore) }"></div>
                  </div>
                  <span class="health-label" :style="{ color: healthColor(client.healthScore) }">
                    {{ client.healthScore }} — {{ healthLabel(client.healthScore) }}
                  </span>
                </div>
              </td>
              <td data-label="Estado">
                <span class="status-badge" :class="client.status.toLowerCase()">{{ client.status }}</span>
              </td>
              <td data-label="Acciones">
                <div class="row-actions">
                  <button class="btn-secondary" @click="viewProfile(client.id)">Ver Perfil</button>
                  <button class="btn-danger" @click="confirmDeleteClient(client)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DashboardCard>

    <!-- Modal: Añadir Cliente -->
    <div class="modal-overlay" v-if="showModal">
      <div class="modal-box">
        <p class="modal-title">Nuevo Cliente</p>

        <div class="form-row">
          <div class="form-group" style="position:relative;">
            <label>Nombre de empresa *</label>
            <input
              v-model="form.name"
              class="form-input"
              :class="{ 'input-error': clienteYaExiste }"
              placeholder="Bar La Flecha"
              autocomplete="off"
              @focus="showNameDropdown = true"
              @blur="hideNameDropdown"
            />
            <p v-if="clienteYaExiste" class="field-error">Ya existe un cliente con este nombre.</p>
            <ul v-if="showNameDropdown && sugerenciasNombre.length" class="name-dropdown">
              <li
                v-for="nombre in sugerenciasNombre"
                :key="nombre"
                class="name-dropdown-item existing"
                @mousedown.prevent="seleccionarNombre(nombre)"
              >
                ⚠️ {{ nombre }} <span class="exists-tag">ya existe</span>
              </li>
            </ul>
          </div>
          <div class="form-group">
            <label>Sector / Industria</label>
            <input v-model="form.industry" class="form-input" placeholder="Hostelería" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre de contacto *</label>
            <input v-model="form.contact" class="form-input" placeholder="Pedro García" />
          </div>
          <div class="form-group">
            <label>Email de contacto</label>
            <input v-model="form.contactEmail" type="email" class="form-input" placeholder="pedro@empresa.com" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Estado</label>
            <select v-model="form.status" class="form-input">
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>
          <div class="form-group">
            <label>URL del logo</label>
            <input v-model="form.logo" class="form-input" placeholder="https://..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>CIF / NIF</label>
            <input v-model="form.cif" class="form-input" placeholder="B-12345678" />
          </div>
        </div>
        <div class="form-group">
          <label>Dirección de facturación</label>
          <input v-model="form.direccionFacturacion" class="form-input" placeholder="Calle Ejemplo, 1, 28001 Madrid" />
        </div>

        <!-- Email de bienvenida -->
        <div class="email-section">
          <div class="email-section-header">
            <span class="section-label">Email de bienvenida</span>
            <label class="toggle-row">
              <input type="checkbox" v-model="emailConfig.enviar" :disabled="!form.contactEmail" />
              <span>Enviar email al contacto</span>
            </label>
          </div>
          <p v-if="!form.contactEmail" class="field-hint" style="margin:0.25rem 0 0;">Introduce un email de contacto para activar esta opción.</p>

          <template v-if="emailConfig.enviar && form.contactEmail">
            <div class="form-group" style="margin-top:0.75rem;">
              <label>Mensaje personalizado (opcional)</label>
              <textarea
                v-model="emailConfig.mensaje"
                class="form-input"
                rows="2"
                placeholder="Estamos encantados de comenzar este proyecto contigo..."
                style="resize:vertical;"
              ></textarea>
            </div>

            <div class="form-group">
              <label>Materiales / documentación necesaria para el proyecto</label>
              <div class="checklist-presets">
                <button
                  v-for="item in ITEMS_PREDEFINIDOS"
                  :key="item"
                  type="button"
                  class="preset-chip"
                  :class="{ active: emailConfig.checklist.includes(item) }"
                  @click="toggleChecklistItem(item)"
                >
                  <span class="chip-icon">{{ emailConfig.checklist.includes(item) ? '✓' : '+' }}</span>
                  {{ item }}
                </button>
              </div>
              <div class="custom-item-row">
                <input
                  v-model="emailConfig.nuevoItem"
                  class="form-input"
                  placeholder="Añadir elemento personalizado..."
                  @keydown.enter.prevent="addCustomItem"
                />
                <button class="btn-add-item" type="button" @click="addCustomItem">+</button>
              </div>
              <div v-if="emailConfig.checklist.length" class="checklist-summary">
                <p class="checklist-summary-title">Elementos en el email:</p>
                <ul class="checklist-summary-list">
                  <li v-for="item in emailConfig.checklist" :key="item" class="checklist-summary-item">
                    <span>{{ item }}</span>
                    <button type="button" @click="emailConfig.checklist = emailConfig.checklist.filter(i => i !== item)">×</button>
                  </li>
                </ul>
                <button type="button" class="btn-clear" @click="emailConfig.checklist = []">Limpiar todo</button>
              </div>
            </div>
          </template>
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <div class="modal-actions">
          <button class="btn-text" @click="showModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveClient" :disabled="saving || !form.name || !form.contact">
            {{ saving ? 'Guardando...' : 'Crear Cliente' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--color-text-muted); font-size: 1.1rem; }
.loading-state, .empty-state { color: var(--color-text-muted); font-style: italic; padding: 1.5rem 0; text-align: center; }

.filters-container { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 0; background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.6rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; color-scheme: dark; }
.search-input:focus { border-color: var(--color-primary); }
.status-select { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.6rem 1rem; border-radius: 6px; font-family: inherit; outline: none; color-scheme: dark; }
.btn-primary { background-color: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary); font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; }
.btn-secondary:hover { background: rgba(227,255,4,0.1); }
.row-actions { display: flex; gap: 0.5rem; align-items: center; }
.btn-danger { background: rgba(255,68,68,0.15); color: #f87171; border: 1px solid rgba(255,68,68,0.3); font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn-danger:hover { background: rgba(255,68,68,0.3); border-color: #f87171; }

.data-table { width: 100%; border-collapse: collapse; text-align: left; }
.data-table th, .data-table td { padding: 1rem; border-bottom: 1px solid var(--color-border); }
.data-table th { color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; }
.client-name-cell { display: flex; flex-direction: column; }
.client-industry { font-size: 0.8rem; color: var(--color-text-muted); }
.text-success { color: #4ade80; }
.text-warning { color: #facc15; }
.status-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.status-badge.activo { background: rgba(74,222,128,0.2); color: #4ade80; }
.status-badge.inactivo { background: rgba(248,113,113,0.2); color: #f87171; }

.health-cell { display: flex; flex-direction: column; gap: 4px; min-width: 80px; }
.health-bar-bg { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; }
.health-bar    { height: 4px; border-radius: 2px; transition: width 0.4s; }
.health-label  { font-size: 0.75rem; font-weight: 600; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 540px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; overflow-x: hidden; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { color: #ff4444; font-size: 0.9rem; margin-bottom: 0.5rem; }

/* Email section */
.email-section { border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: rgba(227,255,4,0.03); }
.email-section-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.section-label { font-size: 0.8rem; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.06em; }
.toggle-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--color-text-muted); cursor: pointer; }
.toggle-row input[type="checkbox"] { accent-color: var(--color-primary); cursor: pointer; }
.field-hint { font-size: 0.78rem; color: var(--color-text-muted); }
.field-error { font-size: 0.78rem; color: #f87171; margin: 0.25rem 0 0; }
.input-error { border-color: #f87171 !important; }
.name-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 6px; margin-top: 2px; z-index: 100; list-style: none; padding: 0; max-height: 180px; overflow-y: auto; box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
.name-dropdown-item { padding: 0.6rem 1rem; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
.name-dropdown-item:hover { background: rgba(255,255,255,0.06); }
.exists-tag { font-size: 0.72rem; background: rgba(248,113,113,0.15); color: #f87171; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: auto; }
.checklist-presets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
.preset-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.7rem; border-radius: 20px; border: 1px solid var(--color-border); background: var(--color-bg-lighter); color: var(--color-text-muted); font-size: 0.78rem; cursor: pointer; transition: all 0.15s; }
.preset-chip:hover { border-color: var(--color-primary); color: var(--color-text-light); }
.preset-chip.active { border-color: var(--color-primary); background: rgba(227,255,4,0.1); color: var(--color-primary); font-weight: 600; }
.chip-icon { font-weight: 700; }
.custom-item-row { display: flex; gap: 0.5rem; align-items: center; }
.btn-add-item { flex-shrink: 0; width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg-lighter); color: var(--color-primary); font-size: 1.3rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.btn-add-item:hover { border-color: var(--color-primary); background: rgba(227,255,4,0.08); }
.checklist-summary { display: flex; flex-direction: column; margin-top: 0.5rem; gap: 0.25rem; }
.btn-clear { background: none; border: none; color: #f87171; font-size: 0.78rem; cursor: pointer; padding: 0; align-self: flex-start; }
.checklist-summary-title { font-size: 0.75rem; color: #999; margin: 0 0 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
.checklist-summary-list { list-style: none; padding: 0; margin: 0 0 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }
.checklist-summary-item { display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; padding: 0.3rem 0.5rem; font-size: 0.82rem; color: #d4d4d4; }
.checklist-summary-item button { background: none; border: none; color: #666; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0 0 0.5rem; }
.checklist-summary-item button:hover { color: #ff4444; }

.success-toast {
  position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
  background: #1a1a1a; border: 1px solid #4ade80; border-radius: 8px;
  padding: 0.9rem 1.4rem; color: #4ade80; font-size: 0.9rem; font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px); }

@media (max-width: 768px) {
  .filters-container { flex-direction: column; align-items: stretch; }
  .form-row { flex-direction: column; }
}
@media (max-width: 600px) {
  .table-responsive { overflow-x: auto; }
  .data-table th:nth-child(3),
  .data-table td:nth-child(3) { display: none; }
}
</style>
