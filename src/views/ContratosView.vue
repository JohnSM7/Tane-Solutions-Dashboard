<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useContratos, createContrato, updateContrato, deleteContrato,
  diasParaRenovacion, renovacionColor, renovacionLabel,
  type Contrato,
} from '../services/contratos';
import { useClientsList } from '../services/clients';
import { exportCsv } from '../utils/exportCsv';

const { contratos, loading } = useContratos();
const { clients } = useClientsList();

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

// ── KPIs ──────────────────────────────────────────────────────────────────────
const kpis = computed(() => {
  const activos   = contratos.value.filter(c => c.estado === 'Activo');
  const mrr       = activos.reduce((s, c) => {
    if (c.tipo === 'Mensual' || c.tipo === 'Retainer') return s + c.valor_mensual;
    if (c.tipo === 'Anual') return s + c.valor_mensual / 12;
    return s;
  }, 0);
  const arr       = mrr * 12;
  const proximos  = activos.filter(c => {
    const d = diasParaRenovacion(c.fecha_renovacion);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const vencidos  = contratos.value.filter(c => {
    const d = diasParaRenovacion(c.fecha_renovacion);
    return d !== null && d < 0 && c.estado === 'Activo';
  }).length;
  return { activos: activos.length, mrr, arr, proximos, vencidos };
});

// ── Filtros ───────────────────────────────────────────────────────────────────
const searchQuery  = ref('');
const filterEstado = ref('');
const filterTipo   = ref('');

const filtered = computed(() =>
  contratos.value.filter(c => {
    const q = searchQuery.value.toLowerCase();
    const matchSearch =
      c.nombre.toLowerCase().includes(q) ||
      (c.clientes?.nombre ?? '').toLowerCase().includes(q);
    const matchEstado = !filterEstado.value || c.estado === filterEstado.value;
    const matchTipo   = !filterTipo.value   || c.tipo   === filterTipo.value;
    return matchSearch && matchEstado && matchTipo;
  })
);

// ── Modal ─────────────────────────────────────────────────────────────────────
const showModal  = ref(false);
const saving     = ref(false);
const editingId  = ref<string | null>(null);
const errorMsg   = ref('');

const emptyForm = () => ({
  cliente_id:       '',
  nombre:           '',
  tipo:             'Mensual' as Contrato['tipo'],
  valor_mensual:    0,
  fecha_inicio:     new Date().toISOString().split('T')[0],
  fecha_renovacion: '',
  estado:           'Activo' as Contrato['estado'],
  notas:            '',
});
const form = ref(emptyForm());

const openNew = () => {
  form.value = emptyForm();
  editingId.value = null;
  errorMsg.value  = '';
  showModal.value = true;
};

const openEdit = (c: Contrato) => {
  form.value = {
    cliente_id:       c.cliente_id,
    nombre:           c.nombre,
    tipo:             c.tipo,
    valor_mensual:    c.valor_mensual,
    fecha_inicio:     c.fecha_inicio,
    fecha_renovacion: c.fecha_renovacion ?? '',
    estado:           c.estado,
    notas:            c.notas,
  };
  editingId.value = c.id;
  errorMsg.value  = '';
  showModal.value = true;
};

const save = async () => {
  errorMsg.value = '';
  saving.value = true;
  try {
    const payload = {
      ...form.value,
      fecha_renovacion: form.value.fecha_renovacion || null,
      cliente_id: form.value.cliente_id || null,
    } as any;

    if (editingId.value) {
      const updated = await updateContrato(editingId.value, payload);
      const idx = contratos.value.findIndex(c => c.id === editingId.value);
      if (idx !== -1) contratos.value[idx] = updated;
    } else {
      const created = await createContrato(payload);
      contratos.value.unshift(created);
    }
    showModal.value = false;
  } catch (e: any) {
    errorMsg.value = e.message ?? 'Error al guardar';
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async (c: Contrato) => {
  if (!confirm(`¿Eliminar contrato "${c.nombre}"?`)) return;
  await deleteContrato(c.id);
  contratos.value = contratos.value.filter(x => x.id !== c.id);
};

const exportar = () => exportCsv('contratos.csv', filtered.value.map(c => ({
  Cliente:         c.clientes?.nombre ?? '',
  Contrato:        c.nombre,
  Tipo:            c.tipo,
  'Valor/mes':     c.valor_mensual,
  'Fecha inicio':  c.fecha_inicio,
  Renovación:      c.fecha_renovacion ?? '',
  Estado:          c.estado,
  Notas:           c.notas,
})));
</script>

<template>
  <div class="view-container">
    <div class="header">
      <div>
        <h1>Contratos</h1>
        <span class="subtitle">Seguimiento de contratos y fechas de renovación</span>
      </div>
      <div class="header-actions">
        <button class="btn-outline-sm" @click="exportar">↓ CSV</button>
        <button class="btn-primary" @click="openNew">+ Nuevo Contrato</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" v-if="!loading">
      <div class="kpi-card">
        <span class="kpi-label">Contratos activos</span>
        <span class="kpi-value">{{ kpis.activos }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">MRR</span>
        <span class="kpi-value primary">{{ fmt(kpis.mrr) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">ARR</span>
        <span class="kpi-value primary">{{ fmt(kpis.arr) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Renueva en 30 días</span>
        <span class="kpi-value" :style="{ color: kpis.proximos > 0 ? '#ffa500' : '#4ade80' }">
          {{ kpis.proximos }}
        </span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Vencidos</span>
        <span class="kpi-value" :style="{ color: kpis.vencidos > 0 ? '#f87171' : '#4ade80' }">
          {{ kpis.vencidos }}
        </span>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filters-bar">
      <input v-model="searchQuery" class="search-input" placeholder="Buscar cliente o contrato..." />
      <select v-model="filterEstado" class="select-filter">
        <option value="">Todos los estados</option>
        <option value="Activo">Activo</option>
        <option value="Pausado">Pausado</option>
        <option value="Cancelado">Cancelado</option>
      </select>
      <select v-model="filterTipo" class="select-filter">
        <option value="">Todos los tipos</option>
        <option value="Mensual">Mensual</option>
        <option value="Anual">Anual</option>
        <option value="Retainer">Retainer</option>
        <option value="Puntual">Puntual</option>
      </select>
    </div>

    <DashboardCard title="Contratos">
      <div v-if="loading" class="empty-state">Cargando contratos...</div>
      <div v-else-if="filtered.length === 0" class="empty-state">
        No hay contratos que coincidan.
      </div>
      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contrato</th>
              <th>Tipo</th>
              <th class="ta-r">Valor/mes</th>
              <th>Renovación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.id">
              <td data-label="Cliente">
                <strong>{{ c.clientes?.nombre ?? '—' }}</strong>
              </td>
              <td data-label="Contrato">
                <div class="contrato-cell">
                  <span>{{ c.nombre }}</span>
                  <span v-if="c.notas" class="muted small">{{ c.notas }}</span>
                </div>
              </td>
              <td data-label="Tipo">
                <span class="tipo-badge">{{ c.tipo }}</span>
              </td>
              <td data-label="Valor/mes" class="ta-r primary">{{ fmt(c.valor_mensual) }}</td>
              <td data-label="Renovación">
                <div class="renovacion-cell">
                  <span
                    class="renovacion-label"
                    :style="{ color: renovacionColor(diasParaRenovacion(c.fecha_renovacion)) }"
                  >
                    {{ renovacionLabel(diasParaRenovacion(c.fecha_renovacion)) }}
                  </span>
                  <span class="muted small" v-if="c.fecha_renovacion">
                    {{ new Date(c.fecha_renovacion).toLocaleDateString('es-ES') }}
                  </span>
                </div>
              </td>
              <td data-label="Estado">
                <span class="estado-badge" :class="c.estado.toLowerCase()">{{ c.estado }}</span>
              </td>
              <td data-label="Acciones">
                <div class="row-actions">
                  <button class="btn-secondary" @click="openEdit(c)">Editar</button>
                  <button class="btn-danger" @click="confirmDelete(c)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DashboardCard>

    <!-- Modal -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingId ? 'Editar Contrato' : 'Nuevo Contrato' }}</p>

        <div class="form-row">
          <div class="form-group">
            <label>Cliente</label>
            <select v-model="form.cliente_id" class="form-input">
              <option value="">— Sin cliente —</option>
              <option v-for="cl in clients" :key="cl.id" :value="cl.id">{{ cl.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo *</label>
            <select v-model="form.tipo" class="form-input">
              <option value="Mensual">Mensual</option>
              <option value="Anual">Anual</option>
              <option value="Retainer">Retainer</option>
              <option value="Puntual">Puntual</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Nombre del contrato *</label>
          <input v-model="form.nombre" class="form-input" placeholder="Ej. SEO + GMB mensual" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Valor mensual (€)</label>
            <input v-model.number="form.valor_mensual" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select v-model="form.estado" class="form-input">
              <option value="Activo">Activo</option>
              <option value="Pausado">Pausado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Fecha inicio</label>
            <input v-model="form.fecha_inicio" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Fecha renovación</label>
            <input v-model="form.fecha_renovacion" type="date" class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label>Notas</label>
          <textarea v-model="form.notas" class="form-input" rows="2" placeholder="Observaciones opcionales"></textarea>
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

        <div class="modal-actions">
          <button class="btn-text" @click="showModal = false">Cancelar</button>
          <button class="btn-primary" @click="save" :disabled="saving || !form.nombre">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root { --color-primary: #E3FF04; }

.view-container  { display: flex; flex-direction: column; gap: 2rem; }
.header          { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
.header h1       { font-size: 2rem; margin-bottom: 0.25rem; }
.subtitle        { color: var(--color-text-muted); font-size: 1rem; }
.header-actions  { display: flex; gap: 0.75rem; align-items: center; }

/* KPIs */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}
.kpi-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-label { font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; }
.kpi-value { font-size: 1.8rem; font-weight: 800; }
.kpi-value.primary { color: var(--color-primary); }

/* Filters */
.filters-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.search-input  { flex: 1; min-width: 0; background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.6rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; color-scheme: dark; }
.search-input:focus { border-color: var(--color-primary); }
.select-filter { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.6rem 1rem; border-radius: 6px; font-family: inherit; outline: none; color-scheme: dark; }

/* Table */
.table-responsive { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; }
.data-table th, .data-table td { padding: 0.9rem 1rem; border-bottom: 1px solid var(--color-border); }
.data-table th { color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.8rem; }
.ta-r   { text-align: right; }
.primary { color: var(--color-primary); font-weight: 700; }
.muted  { color: var(--color-text-muted); }
.small  { font-size: 0.78rem; }

.contrato-cell, .renovacion-cell { display: flex; flex-direction: column; gap: 2px; }
.renovacion-label { font-weight: 600; font-size: 0.88rem; }

.tipo-badge {
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--color-border);
  padding: 2px 8px; border-radius: 4px;
  font-size: 0.78rem; font-weight: 600;
}

.estado-badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700; }
.estado-badge.activo    { background: rgba(74,222,128,0.15);  color: #4ade80; }
.estado-badge.pausado   { background: rgba(250,204,21,0.15);  color: #facc15; }
.estado-badge.cancelado { background: rgba(248,113,113,0.15); color: #f87171; }

.row-actions { display: flex; gap: 0.5rem; }
.btn-secondary { background: transparent; color: var(--color-primary); border: 1px solid var(--color-primary); font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; }
.btn-secondary:hover { background: rgba(227,255,4,0.1); }
.btn-danger { background: rgba(255,68,68,0.15); color: #f87171; border: 1px solid rgba(255,68,68,0.3); font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
.btn-danger:hover { background: rgba(255,68,68,0.3); }

.empty-state { color: var(--color-text-muted); font-style: italic; padding: 2rem; text-align: center; }

/* Buttons */
.btn-primary { background-color: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline-sm { background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); padding: 0.5rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.88rem; }
.btn-outline-sm:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 560px; max-height: 90vh; overflow-y: auto; overflow-x: hidden; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; resize: vertical; }
.form-input:focus { border-color: var(--color-primary); }
.error-msg { color: #ff4444; font-size: 0.9rem; margin-bottom: 0.5rem; }

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .form-row { flex-direction: column; }
  .filters-bar { flex-direction: column; }
}
</style>
