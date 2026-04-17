<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useCommercialData, createLead, updateLead, deleteLead,
  PIPELINE_STAGES, ESTADO_COLORS, type Lead,
} from '../services/commercial';
import { createProyectoRentabilidad, createFacturasFromPlan } from '../services/financial';
import { createClient } from '../services/clients';

const { leads, kpis, pipeline, topServices, loading } = useCommercialData();

// ── Modal nuevo/editar lead ──────────────────────────────────────────────────
const showModal = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);

const emptyForm = (): Partial<Lead> => ({
  nombre: '', empresa: '', email: '', telefono: '',
  fuente: 'Orgánico', servicio: '', estado: 'Nuevo',
  valor_estimado: 0, cac: 0, notas: '',
});
const form = ref<Partial<Lead>>(emptyForm());

const openNew = () => {
  form.value = emptyForm();
  editingId.value = null;
  showModal.value = true;
};

const openEdit = (lead: Lead) => {
  form.value = { ...lead };
  editingId.value = lead.id;
  showModal.value = true;
};

const saveLead = async () => {
  saving.value = true;
  try {
    if (editingId.value) {
      const updated = await updateLead(editingId.value, form.value);
      const idx = leads.value.findIndex(l => l.id === editingId.value);
      if (idx !== -1) leads.value[idx] = updated;
      
      if (updated.estado === 'Cerrado-Ganado') {
        await handleCierreGanado(updated);
      }
    } else {
      const created = await createLead(form.value);
      leads.value.unshift(created);
      
      if (created.estado === 'Cerrado-Ganado') {
        await handleCierreGanado(created);
      }
    }
    showModal.value = false;
  } catch (error: any) {
    console.error('[saveLead] Error al guardar:', error);
    alert('Error al guardar: ' + (error.message || 'No se pudo completar la operación'));
  } finally {
    saving.value = false;
  }
};

const handleCierreGanado = async (lead: Lead) => {
  try {
    let clientId = lead.cliente_id;
    
    // 1. Si el lead no está vinculado a un cliente, creamos el cliente automáticamente
    if (!clientId) {
      const newClient = await createClient({
        name: lead.empresa || lead.nombre,
        contact: lead.nombre,
        contactEmail: lead.email,
        industry: lead.servicio || 'Marketing/Ventas',
        status: 'Activo'
      });
      clientId = newClient.id;
      // Actualizamos el lead para que quede constancia del vínculo
      await updateLead(lead.id, { cliente_id: clientId });
    }

    // 2. Creamos el proyecto en el módulo financiero
    const project = await createProyectoRentabilidad({
      nombre: `Proyecto: ${lead.empresa || lead.nombre}`,
      cliente_id: clientId,
      presupuesto: lead.valor_estimado,
      coste: 0,
      plan_pago: '50/50', // Plan predeterminado
      fecha_inicio: new Date().toISOString().split('T')[0]
    });

    // 3. Generamos las facturas iniciales según el plan
    await createFacturasFromPlan(project, clientId);
    
    console.log('[handleCierreGanado] Proyecto y facturas creados con éxito');
  } catch (err) {
    console.error('[handleCierreGanado] Error en automatización:', err);
    alert('Lead cerrado, pero hubo un problema creando el proyecto financiero. Por favor, créalo manualmente.');
  }
};

const confirmDelete = async (lead: Lead) => {
  if (!confirm(`¿Eliminar el lead "${lead.nombre}"?`)) return;
  await deleteLead(lead.id);
  leads.value = leads.value.filter(l => l.id !== lead.id);
};

// ── Cambio rápido de estado desde la tabla ───────────────────────────────────
const changeEstado = async (lead: Lead, estado: string) => {
  try {
    const updates: Partial<Lead> = { estado: estado as Lead['estado'] };
    if (estado === 'Cerrado-Ganado' || estado === 'Cerrado-Perdido') {
      updates.fecha_cierre = new Date().toISOString();
    }
    const updated = await updateLead(lead.id, updates);
    const idx = leads.value.findIndex(l => l.id === lead.id);
    if (idx !== -1) leads.value[idx] = updated;

    if (estado === 'Cerrado-Ganado') {
      await handleCierreGanado(updated);
    }
  } catch (error: any) {
    console.error('[changeEstado] Error:', error);
    alert('Error al cambiar estado: ' + (error.message || 'Error desconocido'));
  }
};

// ── Filtros ──────────────────────────────────────────────────────────────────
const filtroEstado  = ref('');
const searchLeads   = ref('');
const filteredLeads = computed(() => {
  const q = searchLeads.value.trim().toLowerCase();
  return leads.value.filter(l => {
    const matchEstado = !filtroEstado.value || l.estado === filtroEstado.value;
    const matchSearch = !q ||
      (l.nombre  ?? '').toLowerCase().includes(q) ||
      (l.empresa ?? '').toLowerCase().includes(q) ||
      (l.servicio ?? '').toLowerCase().includes(q) ||
      (l.email   ?? '').toLowerCase().includes(q);
    return matchEstado && matchSearch;
  });
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short' });
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo Comercial</h1>
      <span class="subtitle">El Motor de Ventas</span>
    </div>

    <div v-if="loading" class="loading-state">Cargando datos...</div>

    <template v-else>
      <!-- KPIs (calculados automáticamente) -->
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

      <!-- Pipeline + Top Servicios -->
      <div class="content-grid">
        <DashboardCard title="Embudo de Ventas (Pipeline)">
          <div v-if="leads.length === 0" class="empty-chart">
            Añade leads para ver el pipeline
          </div>
          <div v-else class="funnel-container">
            <div v-for="step in pipeline" :key="step.label" class="funnel-step"
              :class="{ highlight: step.highlight }"
              :style="{ width: step.width }">
              {{ step.label }} ({{ step.count }})
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Top Servicios (Cerrados-Ganados)">
          <div v-if="topServices.length === 0" class="empty-chart">
            Los servicios aparecen cuando cierres leads
          </div>
          <ul v-else class="services-list">
            <li v-for="svc in topServices" :key="svc.name" class="service-item">
              <div class="service-info">
                <span class="service-name">{{ svc.name }}</span>
                <span class="service-sales">{{ svc.sales }} ventas</span>
              </div>
              <div class="progress-bar">
                <div class="fill" :style="{ width: svc.value }"></div>
              </div>
            </li>
          </ul>
        </DashboardCard>
      </div>

      <!-- Tabla de Leads -->
      <DashboardCard title="Leads">
        <template #actions>
          <div class="table-controls">
            <input v-model="searchLeads" type="text" placeholder="Buscar nombre, empresa…" class="search-input-sm" />
            <select v-model="filtroEstado" class="filter-select">
              <option value="">Todos los estados</option>
              <option v-for="s in PIPELINE_STAGES" :key="s" :value="s">{{ s }}</option>
              <option value="Cerrado-Perdido">Cerrado-Perdido</option>
            </select>
            <button class="btn-primary-sm" @click="openNew">+ Nuevo Lead</button>
          </div>
        </template>

        <div v-if="filteredLeads.length === 0" class="empty-state">
          No hay leads todavía. Añade el primero.
        </div>
        <div v-else class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre / Empresa</th>
                <th>Servicio</th>
                <th>Valor</th>
                <th>Fuente</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lead in filteredLeads" :key="lead.id">
                <td>
                  <div class="cell-stack">
                    <strong>{{ lead.nombre }}</strong>
                    <span class="muted">{{ lead.empresa }}</span>
                  </div>
                </td>
                <td>{{ lead.servicio || '—' }}</td>
                <td>{{ lead.valor_estimado > 0 ? `${lead.valor_estimado.toLocaleString('es-ES')} €` : '—' }}</td>
                <td>{{ lead.fuente }}</td>
                <td>
                  <select
                    class="estado-select"
                    :value="lead.estado"
                    :style="{ color: ESTADO_COLORS[lead.estado] }"
                    @change="changeEstado(lead, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="s in [...PIPELINE_STAGES, 'Cerrado-Perdido']" :key="s" :value="s">{{ s }}</option>
                  </select>
                </td>
                <td class="muted">{{ formatDate(lead.fecha_creacion) }}</td>
                <td>
                  <div class="row-actions">
                    <button class="btn-icon-text" @click="openEdit(lead)">✏️</button>
                    <button class="btn-icon-text danger" @click="confirmDelete(lead)">🗑️</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </template>

    <!-- Modal: Nuevo / Editar Lead -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingId ? 'Editar Lead' : 'Nuevo Lead' }}</p>

        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input v-model="form.nombre" class="form-input" />
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <input v-model="form.empresa" class="form-input" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input v-model="form.email" type="email" class="form-input" />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input v-model="form.telefono" class="form-input" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fuente</label>
            <select v-model="form.fuente" class="form-input">
              <option>Orgánico</option>
              <option>Google Ads</option>
              <option>Instagram</option>
              <option>Referido</option>
              <option>Web</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label>Servicio de interés</label>
            <input v-model="form.servicio" class="form-input" placeholder="Pack Starter, SEO..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Valor estimado ($)</label>
            <input v-model.number="form.valor_estimado" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>CAC ($)</label>
            <input v-model.number="form.cac" type="number" min="0" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select v-model="form.estado" class="form-input">
            <option v-for="s in [...PIPELINE_STAGES, 'Cerrado-Perdido']" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea v-model="form.notas" class="form-input" rows="3"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-text" @click="showModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveLead" :disabled="saving || !form.nombre">
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

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.kpi-item { display: flex; flex-direction: column; }
.kpi-label { font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }
.kpi-value { font-size: 2rem; font-weight: 700; margin-right: 1rem; }
.kpi-trend { font-size: 0.8rem; font-weight: 600; }
.kpi-value-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

.funnel-container { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1rem 0; }
.funnel-step { background-color: var(--color-primary); color: #000; text-align: center; padding: 0.8rem; font-weight: 700; border-radius: 4px; white-space: nowrap; min-width: 160px; }
.funnel-step.highlight { background-color: #4ade80; }

.services-list { list-style: none; padding: 0; }
.service-item { margin-bottom: 1.5rem; }
.service-info { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 500; }
.progress-bar { width: 100%; height: 6px; background-color: var(--color-bg-lighter); border-radius: 3px; overflow: hidden; }
.fill { height: 100%; background-color: var(--color-primary); }

.table-controls { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.search-input-sm { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.3rem 0.7rem; border-radius: 4px; font-size: 0.85rem; outline: none; color-scheme: dark; min-width: 180px; }
.search-input-sm:focus { border-color: var(--color-primary); }
.filter-select { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.85rem; outline: none; color-scheme: dark; }
.btn-primary-sm { background: var(--color-primary); color: #000; font-weight: 700; font-size: 0.85rem; padding: 0.35rem 0.9rem; border: none; border-radius: 4px; cursor: pointer; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 0.85rem 0.75rem; text-align: left; border-bottom: 1px solid var(--color-border); }
.data-table th { color: var(--color-text-muted); font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
.cell-stack { display: flex; flex-direction: column; }
.muted { font-size: 0.8rem; color: var(--color-text-muted); }

.estado-select { background: transparent; border: 1px solid var(--color-border); border-radius: 12px; padding: 0.25rem 0.5rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; outline: none; color-scheme: dark; }
.estado-select:focus { border-color: var(--color-primary); }
.row-actions { display: flex; gap: 0.5rem; }
.btn-icon-text { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.25rem; border-radius: 4px; }
.btn-icon-text:hover { background: rgba(255,255,255,0.1); }
.btn-icon-text.danger:hover { background: rgba(255,68,68,0.15); }

.empty-state { color: var(--color-text-muted); text-align: center; padding: 2rem; font-style: italic; }
.empty-chart { color: var(--color-text-muted); text-align: center; padding: 3rem 1rem; font-style: italic; }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 560px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
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
