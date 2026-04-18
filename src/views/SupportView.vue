<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useSupportData, createTicket, updateTicket, deleteTicket,
  createServidor, updateServidor, deleteServidor,
  SERVIDOR_COLORS, type Ticket, type Servidor,
} from '../services/support';
import { useClientsList } from '../services/clients';
import { useToast } from '../composables/useToast';
import { exportCsv } from '../utils/exportCsv';

const { tickets, servidores, kpis, loading } = useSupportData();
const { clients } = useClientsList();
const toast = useToast();

const exportTickets = () => exportCsv('tickets.csv', tickets.value.map(t => ({
  ID: t.id, Asunto: t.asunto,
  Cliente: t.clientes?.nombre ?? '',
  Estado: t.estado, Prioridad: t.prioridad,
  'Fecha creación': t.fecha_creacion?.slice(0, 10) ?? '',
  'Fecha cierre': t.fecha_cierre?.slice(0, 10) ?? '',
})));

// ── Búsqueda de tickets ───────────────────────────────────────────────────────
const searchTickets = ref('');
const filteredTickets = computed(() => {
  const q = searchTickets.value.trim().toLowerCase();
  if (!q) return tickets.value;
  return tickets.value.filter(t =>
    t.asunto.toLowerCase().includes(q) ||
    (t.clientes?.nombre ?? '').toLowerCase().includes(q) ||
    (t.descripcion ?? '').toLowerCase().includes(q),
  );
});

// ── Tickets ──────────────────────────────────────────────────────────────────
const showTicketModal = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);

const emptyForm = (): Partial<Ticket> => ({
  asunto: '', descripcion: '', cliente_id: '', prioridad: 'Media', estado: 'Abierto',
});
const form = ref<Partial<Ticket>>(emptyForm());

const openNew = () => { form.value = emptyForm(); editingId.value = null; showTicketModal.value = true; };
const openEdit = (t: Ticket) => { form.value = { ...t }; editingId.value = t.id; showTicketModal.value = true; };

const saveTicket = async () => {
  saving.value = true;
  try {
    const payload = { ...form.value };
    if (!payload.cliente_id) delete payload.cliente_id;
    if (editingId.value !== null) {
      const updated = await updateTicket(editingId.value, payload);
      const idx = tickets.value.findIndex(t => t.id === editingId.value);
      if (idx !== -1) tickets.value[idx] = updated;
      toast.success('Ticket actualizado correctamente');
    } else {
      const created = await createTicket(payload);
      tickets.value.unshift(created);
      toast.success('Ticket creado correctamente');
    }
    showTicketModal.value = false;
  } catch {
    toast.error('No se pudo guardar el ticket. Inténtalo de nuevo.');
  } finally { saving.value = false; }
};

const cambiarEstadoTicket = async (t: Ticket, estado: string) => {
  try {
    const updates: Partial<Ticket> = { estado: estado as Ticket['estado'] };
    if (estado === 'En proceso' && !t.fecha_primera_respuesta) {
      updates.fecha_primera_respuesta = new Date().toISOString();
    }
    if (estado === 'Cerrado') {
      updates.fecha_cierre = new Date().toISOString();
      if (!t.fecha_primera_respuesta) updates.fecha_primera_respuesta = new Date().toISOString();
    }
    const updated = await updateTicket(t.id, updates);
    const idx = tickets.value.findIndex(x => x.id === t.id);
    if (idx !== -1) tickets.value[idx] = updated;
  } catch (error: any) {
    console.error('[cambiarEstadoTicket] Error:', error);
    alert('Error al cambiar el estado del ticket: ' + (error.message || 'Error desconocido'));
  }
};

const setSatisfaccion = async (t: Ticket, val: number) => {
  try {
    const updated = await updateTicket(t.id, { satisfaccion: val });
    const idx = tickets.value.findIndex(x => x.id === t.id);
    if (idx !== -1) tickets.value[idx] = updated;
  } catch (error: any) {
    console.error('[setSatisfaccion] Error:', error);
    alert('Error al guardar la valoración: ' + (error.message || 'Error desconocido'));
  }
};

const confirmDeleteTicket = async (t: Ticket) => {
  if (!confirm(`¿Eliminar ticket #${t.id} "${t.asunto}"?`)) return;
  try {
    await deleteTicket(t.id);
    tickets.value = tickets.value.filter(x => x.id !== t.id);
    toast.success(`Ticket #${t.id} eliminado`);
  } catch {
    toast.error('No se pudo eliminar el ticket.');
  }
};

// ── Servidores ────────────────────────────────────────────────────────────────
const showServidorModal = ref(false);
const savingServidor = ref(false);
const editingServidorId = ref<string | null>(null);
const emptyServidor = (): Partial<Servidor> => ({ nombre: '', estado: 'Online', uptime_porcentaje: 100 });
const servidorForm = ref<Partial<Servidor>>(emptyServidor());

const openNewServidor = () => { servidorForm.value = emptyServidor(); editingServidorId.value = null; showServidorModal.value = true; };
const openEditServidor = (s: Servidor) => { servidorForm.value = { ...s }; editingServidorId.value = s.id; showServidorModal.value = true; };

const saveServidor = async () => {
  savingServidor.value = true;
  try {
    if (editingServidorId.value) {
      const updated = await updateServidor(editingServidorId.value, servidorForm.value);
      const idx = servidores.value.findIndex(s => s.id === editingServidorId.value);
      if (idx !== -1) servidores.value[idx] = updated;
    } else {
      const created = await createServidor(servidorForm.value);
      servidores.value.push(created);
    }
    showServidorModal.value = false;
  } catch (error: any) {
    console.error('[saveServidor] Error:', error);
    alert('Error al guardar el servidor: ' + (error.message || 'Error desconocido'));
  } finally {
    savingServidor.value = false;
  }
};

const confirmDeleteServidor = async (s: Servidor) => {
  if (!confirm(`¿Eliminar servidor "${s.nombre}"?`)) return;
  try {
    await deleteServidor(s.id);
    servidores.value = servidores.value.filter(x => x.id !== s.id);
  } catch (error: any) {
    console.error('[confirmDeleteServidor] Error:', error);
    alert('Error al eliminar el servidor: ' + (error.message || 'Error desconocido'));
  }
};

const cambiarEstadoServidor = async (id: string, estado: string) => {
  try {
    const updated = await updateServidor(id, { estado: estado as any });
    const idx = servidores.value.findIndex(s => s.id === id);
    if (idx !== -1) servidores.value[idx] = updated;
  } catch (error: any) {
    console.error('[cambiarEstadoServidor] Error:', error);
    alert('Error al cambiar el estado del servidor: ' + (error.message || 'Error desconocido'));
  }
};

// ── Utils ────────────────────────────────────────────────────────────────────
const prioridadColor: Record<string, string> = {
  Alta: '#ff4444', Media: '#ffa500', Baja: '#e3ff04',
};
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 60) return `Hace ${Math.round(diff)} min`;
  if (diff < 1440) return `Hace ${Math.round(diff / 60)}h`;
  return `Hace ${Math.round(diff / 1440)}d`;
};
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo de Soporte y Calidad</h1>
      <span class="subtitle">Satisfacción y Retención</span>
    </div>

    <div v-if="loading" class="loading-state">Cargando datos...</div>

    <template v-else>
      <!-- KPIs automáticos -->
      <div class="metrics-grid">
        <DashboardCard v-for="kpi in kpis" :key="kpi.label">
          <div class="kpi-item">
            <span class="kpi-label">{{ kpi.label }}</span>
            <div class="kpi-value-row">
              <span class="kpi-value">{{ kpi.value }}</span>
              <span class="kpi-trend" :style="{ color: kpi.color }">{{ kpi.trend }}</span>
            </div>
          </div>
        </DashboardCard>
      </div>

      <div class="content-grid">
        <!-- Servidores -->
        <DashboardCard title="Estado de Servidores">
          <template #actions>
            <button class="btn-edit-action" @click="openNewServidor">+ Añadir</button>
          </template>
          <div class="servers-list">
            <div v-for="s in servidores" :key="s.id" class="server-item">
              <div class="server-info">
                <div class="server-name-row">
                  <div class="status-dot" :style="{ backgroundColor: SERVIDOR_COLORS[s.estado] }"></div>
                  <span class="server-name">{{ s.nombre }}</span>
                </div>
                <span class="server-uptime">Uptime: {{ s.uptime_porcentaje }}%</span>
              </div>
              <div class="server-right">
                <select
                  class="estado-select"
                  :value="s.estado"
                  :style="{ color: SERVIDOR_COLORS[s.estado] }"
                  @change="cambiarEstadoServidor(s.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option>Online</option>
                  <option>Mantenimiento</option>
                  <option>Offline</option>
                </select>
                <button class="btn-icon-text" @click="openEditServidor(s)" title="Editar">✏️</button>
                <button class="btn-icon-text danger" @click="confirmDeleteServidor(s)" title="Eliminar">🗑️</button>
              </div>
            </div>
          </div>
        </DashboardCard>

        <!-- Tickets -->
        <DashboardCard title="Tickets de Soporte">
          <template #actions>
            <div class="ticket-actions-header">
              <input v-model="searchTickets" type="text" placeholder="Buscar tickets…" class="search-input-sm" />
              <button class="btn-outline-sm" @click="exportTickets">↓ CSV</button>
              <button class="btn-edit-action" @click="openNew">+ Nuevo Ticket</button>
            </div>
          </template>
          <div v-if="filteredTickets.length === 0" class="empty-state">
            {{ searchTickets ? 'Sin resultados para la búsqueda' : 'Sin tickets registrados' }}
          </div>
          <div v-else class="tickets-list">
            <div v-for="t in filteredTickets" :key="t.id" class="ticket-item" :class="{ closed: t.estado === 'Cerrado' }">
              <div class="ticket-top">
                <span class="ticket-id">#{{ t.id }}</span>
                <span class="ticket-time">{{ formatTime(t.fecha_creacion) }}</span>
              </div>
              <div class="ticket-subject">{{ t.asunto }}</div>
              <div class="ticket-meta">
                <span class="muted">{{ t.clientes?.nombre ?? 'Sin cliente' }}</span>
                <span class="priority-badge" :style="{ color: prioridadColor[t.prioridad], borderColor: prioridadColor[t.prioridad] }">
                  {{ t.prioridad }}
                </span>
              </div>
              <div class="ticket-actions">
                <select
                  class="estado-select"
                  :value="t.estado"
                  @change="cambiarEstadoTicket(t, ($event.target as HTMLSelectElement).value)"
                >
                  <option>Abierto</option>
                  <option>En proceso</option>
                  <option>Cerrado</option>
                </select>
                <div v-if="t.estado === 'Cerrado' && !t.satisfaccion" class="sat-row">
                  <span class="muted">Valoración:</span>
                  <button v-for="n in [1,2,3,4,5]" :key="n" class="sat-btn" @click="setSatisfaccion(t, n)">{{ n }}★</button>
                </div>
                <span v-if="t.satisfaccion" class="sat-value">{{ t.satisfaccion }}★ valorado</span>
                <button class="btn-icon-text" @click="openEdit(t)" title="Editar">✏️</button>
                <button class="btn-icon-text danger" @click="confirmDeleteTicket(t)" title="Eliminar">🗑️</button>
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>
    </template>

    <!-- Modal: Servidor -->
    <div class="modal-overlay" v-if="showServidorModal" @click.self="showServidorModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingServidorId ? 'Editar Servidor' : 'Nuevo Servidor' }}</p>
        <div class="form-group">
          <label>Nombre *</label>
          <input v-model="servidorForm.nombre" class="form-input" placeholder="ej: Web Principal (tanesolutions.com)" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Estado</label>
            <select v-model="servidorForm.estado" class="form-input">
              <option>Online</option>
              <option>Mantenimiento</option>
              <option>Offline</option>
            </select>
          </div>
          <div class="form-group">
            <label>Uptime (%)</label>
            <input v-model.number="servidorForm.uptime_porcentaje" type="number" min="0" max="100" step="0.1" class="form-input" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showServidorModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveServidor" :disabled="savingServidor || !servidorForm.nombre">
            {{ savingServidor ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Ticket -->
    <div class="modal-overlay" v-if="showTicketModal" @click.self="showTicketModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingId !== null ? 'Editar Ticket' : 'Nuevo Ticket' }}</p>
        <div class="form-group">
          <label>Asunto *</label>
          <input v-model="form.asunto" class="form-input" />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea v-model="form.descripcion" class="form-input" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Cliente</label>
          <select v-model="form.cliente_id" class="form-input">
            <option value="">— Sin cliente —</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Prioridad</label>
            <select v-model="form.prioridad" class="form-input">
              <option>Alta</option><option>Media</option><option>Baja</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select v-model="form.estado" class="form-input">
              <option>Abierto</option><option>En proceso</option><option>Cerrado</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showTicketModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveTicket" :disabled="saving || !form.asunto">
            {{ saving ? 'Guardando...' : 'Guardar' }}
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
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 1.5rem; }
.kpi-item { display: flex; flex-direction: column; }
.kpi-label { font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }
.kpi-value { font-size: 2rem; font-weight: 700; margin-right: 1rem; }
.kpi-trend { font-size: 0.8rem; font-weight: 600; }
.kpi-value-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

.servers-list { display: flex; flex-direction: column; gap: 0.75rem; }
.server-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px; }
.server-info { display: flex; flex-direction: column; gap: 0.25rem; }
.server-name-row { display: flex; align-items: center; gap: 0.75rem; }
.status-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.server-name { font-weight: 600; }
.server-uptime { font-size: 0.8rem; color: var(--color-text-muted); margin-left: 1.5rem; }

.ticket-actions-header { display: flex; gap: 0.5rem; align-items: center; }
.search-input-sm { background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.82rem; outline: none; color-scheme: dark; min-width: 0; flex: 1; max-width: 200px; }
.search-input-sm:focus { border-color: var(--color-primary); }
.btn-edit-action { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.btn-edit-action:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-outline-sm { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.82rem; padding: 0.3rem 0.7rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.btn-outline-sm:hover { border-color: var(--color-primary); color: var(--color-primary); }

.tickets-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto; }
.ticket-item { background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; }
.ticket-item.closed { opacity: 0.55; }
.ticket-top { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
.ticket-id { color: var(--color-primary); font-family: monospace; font-weight: 700; font-size: 0.85rem; }
.ticket-time { font-size: 0.78rem; color: var(--color-text-muted); }
.ticket-subject { font-weight: 600; margin-bottom: 0.4rem; }
.ticket-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
.muted { font-size: 0.82rem; color: var(--color-text-muted); }
.priority-badge { font-size: 0.75rem; font-weight: 700; border: 1px solid; padding: 0.15rem 0.5rem; border-radius: 10px; }
.ticket-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.estado-select { background: transparent; border: 1px solid var(--color-border); border-radius: 12px; padding: 0.25rem 0.5rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; outline: none; color-scheme: dark; color: var(--color-text-light); }
.sat-row { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; }
.sat-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--color-border); color: var(--color-text-muted); padding: 0.15rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.sat-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.sat-value { font-size: 0.82rem; color: var(--color-primary); font-weight: 700; }
.btn-icon-text { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.25rem; border-radius: 4px; }
.btn-icon-text:hover { background: rgba(255,255,255,0.1); }
.btn-icon-text.danger:hover { background: rgba(255,68,68,0.15); }
.server-right { display: flex; align-items: center; gap: 0.5rem; }

.empty-state { color: var(--color-text-muted); text-align: center; padding: 2rem; font-style: italic; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 480px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; resize: vertical; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background-color: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
