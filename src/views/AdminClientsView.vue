<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import { useClientsList, createClient, deleteClient, healthColor, healthLabel } from '../services/clients';

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

const form = ref({
  name: '', contact: '', contactEmail: '', industry: '', status: 'Activo', logo: '',
  cif: '', direccionFacturacion: '',
});

const openModal = () => {
  form.value = { name: '', contact: '', contactEmail: '', industry: '', status: 'Activo', logo: '', cif: '', direccionFacturacion: '' };
  errorMsg.value = '';
  showModal.value = true;
};

const saveClient = async () => {
  errorMsg.value = '';
  saving.value = true;
  try {
    const newClient = await createClient(form.value);
    clients.value.unshift({ ...newClient, financials: { paid: '0 €', pending: '0 €' }, healthScore: 100 });
    showModal.value = false;
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
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-box">
        <p class="modal-title">Nuevo Cliente</p>

        <div class="form-row">
          <div class="form-group">
            <label>Nombre de empresa *</label>
            <input v-model="form.name" class="form-input" placeholder="Bar La Flecha" />
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
.search-input { flex: 1; min-width: 250px; background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.6rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; color-scheme: dark; }
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

.health-cell { display: flex; flex-direction: column; gap: 4px; min-width: 110px; }
.health-bar-bg { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; }
.health-bar    { height: 4px; border-radius: 2px; transition: width 0.4s; }
.health-label  { font-size: 0.75rem; font-weight: 600; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 540px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
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

@media (max-width: 768px) {
  .filters-container { flex-direction: column; align-items: stretch; }
  .form-row { flex-direction: column; }
}
</style>
