<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useOperationsData, createProyecto, updateProyecto, deleteProyecto,
  updateUsuario,
  ESTADO_COLORS, type Proyecto, type UsuarioAdmin,
} from '../services/operations';
import { useClientsList } from '../services/clients';
import { useTareas, type Tarea } from '../services/tareas';

const { proyectos, equipo, teamLoad, kpis, loading } = useOperationsData();
const { clients } = useClientsList();
const { tareas } = useTareas();

// ── Proyectos ────────────────────────────────────────────────────────────────
const showProyModal = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);

const ESTADOS = ['En curso', 'En riesgo', 'Retrasado', 'Bloqueado', 'Completado'];

const emptyForm = (): Partial<Proyecto> => ({
  nombre: '', cliente_id: '', estado: 'En curso', fase: '',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_entrega_estimada: '', fecha_entrega_real: '',
});
const form = ref<Partial<Proyecto>>(emptyForm());

const openNew = () => { form.value = emptyForm(); editingId.value = null; showProyModal.value = true; };
const openEdit = (p: Proyecto) => { form.value = { ...p }; editingId.value = p.id; showProyModal.value = true; };

const saveProyecto = async () => {
  saving.value = true;
  try {
    const payload = { ...form.value };
    if (!payload.fecha_entrega_estimada) delete payload.fecha_entrega_estimada;
    if (!payload.fecha_entrega_real) delete payload.fecha_entrega_real;
    if (!payload.cliente_id) delete payload.cliente_id;

    const patchCliente = (p: Proyecto) => {
      const cl = clients.value.find(c => c.id === p.cliente_id);
      if (cl) p.clientes = { nombre: cl.name };
      return p;
    };

    if (editingId.value) {
      const updated = patchCliente(await updateProyecto(editingId.value, payload));
      const idx = proyectos.value.findIndex(p => p.id === editingId.value);
      if (idx !== -1) proyectos.value[idx] = updated;
    } else {
      proyectos.value.unshift(patchCliente(await createProyecto(payload)));
    }
    showProyModal.value = false;
  } catch (error: any) {
    alert('Error al guardar el proyecto: ' + (error.message || 'Error desconocido'));
  } finally {
    saving.value = false;
  }
};

const removeProyecto = async (p: Proyecto) => {
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
  try {
    await deleteProyecto(p.id);
    proyectos.value = proyectos.value.filter(x => x.id !== p.id);
  } catch (error: any) {
    alert('Error al eliminar el proyecto: ' + (error.message || 'Error desconocido'));
  }
};

const changeEstado = async (p: Proyecto, estado: string) => {
  try {
    const updates: Partial<Proyecto> = { estado: estado as Proyecto['estado'] };
    if (estado === 'Completado') updates.fecha_entrega_real = new Date().toISOString().split('T')[0];
    const updated = await updateProyecto(p.id, updates);
    const cl = clients.value.find(c => c.id === updated.cliente_id);
    if (cl) updated.clientes = { nombre: cl.name };
    const idx = proyectos.value.findIndex(x => x.id === p.id);
    if (idx !== -1) proyectos.value[idx] = updated;
  } catch (error: any) {
    alert('Error al cambiar el estado: ' + (error.message || 'Error desconocido'));
  }
};

// ── Editar horas disponibles del usuario ──────────────────────────────────────
const showUsuarioModal  = ref(false);
const savingUsuario     = ref(false);
const editingUsuarioId  = ref<string | null>(null);
const usuarioHoras      = ref(40);

const openEditUsuario = (m: UsuarioAdmin) => {
  editingUsuarioId.value = m.id;
  usuarioHoras.value = m.horas_disponibles_semana;
  showUsuarioModal.value = true;
};

const saveUsuario = async () => {
  if (!editingUsuarioId.value) return;
  savingUsuario.value = true;
  try {
    const updated = await updateUsuario(editingUsuarioId.value, { horas_disponibles_semana: usuarioHoras.value });
    const idx = equipo.value.findIndex(m => m.id === editingUsuarioId.value);
    if (idx !== -1) equipo.value[idx] = updated;
    showUsuarioModal.value = false;
  } catch (error: any) {
    alert('Error al actualizar el usuario: ' + (error.message || 'Error desconocido'));
  } finally {
    savingUsuario.value = false;
  }
};

const formatDate = (d?: string | null) => d
  ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' })
  : '—';

// Horas pendientes por miembro calculadas desde tareas (excluye completado)
const horasPendientesMiembro = computed(() => {
  const map = new Map<string, number>();
  for (const t of tareas.value as Tarea[]) {
    if (t.estado === 'completado' || !t.asignado_a) continue;
    map.set(t.asignado_a, (map.get(t.asignado_a) ?? 0) + (t.horas_estimadas ?? 0));
  }
  return map;
});
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo de Operaciones</h1>
      <span class="subtitle">Gestión de Proyectos</span>
    </div>

    <div v-if="loading" class="loading-state">Cargando datos...</div>

    <template v-else>
      <!-- KPIs -->
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
        <!-- Proyectos -->
        <DashboardCard title="Estado de Proyectos">
          <template #actions>
            <button class="btn-edit-action" @click="openNew">+ Añadir</button>
          </template>
          <div v-if="proyectos.length === 0" class="empty-state">Sin proyectos activos</div>
          <div v-else class="projects-list">
            <div v-for="p in proyectos" :key="p.id" class="project-item">
              <div class="project-info">
                <span class="project-name">{{ p.nombre }}</span>
                <span class="project-meta">{{ p.clientes?.nombre ?? '—' }} · {{ p.fase || 'Sin fase' }}</span>
                <span class="project-dates">
                  Inicio: {{ formatDate(p.fecha_inicio) }}
                  <span v-if="p.fecha_entrega_estimada"> · Entrega: {{ formatDate(p.fecha_entrega_estimada) }}</span>
                </span>
              </div>
              <div class="project-right">
                <select
                  class="estado-select"
                  :value="p.estado"
                  :style="{ color: ESTADO_COLORS[p.estado] }"
                  @change="changeEstado(p, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="s in ESTADOS" :key="s" :value="s">{{ s }}</option>
                </select>
                <div class="row-actions">
                  <button class="btn-icon-text" @click="openEdit(p)">✏️</button>
                  <button class="btn-icon-text danger" @click="removeProyecto(p)">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        </DashboardCard>

        <!-- Equipo -->
        <DashboardCard title="Carga de Trabajo del Equipo">
          <div v-if="teamLoad.length === 0" class="empty-state">Sin usuarios con rol Admin</div>
          <div v-else class="team-grid">
            <div v-for="m in teamLoad" :key="m.id" class="team-member">
              <div class="member-info">
                <span>{{ m.nombre }}</span>
                <div class="member-actions">
                  <span :style="{
                    color: (horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana >= 0.85 ? '#ff4444' :
                           (horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana >= 0.65 ? '#ffa500' : '#e3ff04',
                    fontWeight: 700
                  }">
                    {{ m.horas_disponibles_semana > 0
                      ? Math.round((horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana * 100)
                      : 0 }}%
                  </span>
                  <button class="btn-icon-text" @click="openEditUsuario(m)" title="Editar horas disponibles">✏️</button>
                </div>
              </div>
              <div class="load-bar-bg">
                <div class="load-bar-fill" :style="{
                  width: m.horas_disponibles_semana > 0
                    ? Math.min(100, Math.round((horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana * 100)) + '%'
                    : '0%',
                  backgroundColor:
                    (horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana >= 0.85 ? '#ff4444' :
                    (horasPendientesMiembro.get(m.id) ?? 0) / m.horas_disponibles_semana >= 0.65 ? '#ffa500' : '#e3ff04',
                }"></div>
              </div>
              <div class="member-hours">
                {{ horasPendientesMiembro.get(m.id) ?? 0 }}h en tareas activas
                / {{ m.horas_disponibles_semana }}h disponibles
              </div>
            </div>
          </div>
        </DashboardCard>
      </div>
    </template>

    <!-- Modal: Proyecto -->
    <div class="modal-overlay" v-if="showProyModal" @click.self="showProyModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingId ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</p>
        <div class="form-group">
          <label>Nombre *</label>
          <input v-model="form.nombre" class="form-input" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Cliente</label>
            <select v-model="form.cliente_id" class="form-input">
              <option value="">— Sin cliente —</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select v-model="form.estado" class="form-input">
              <option v-for="s in ESTADOS" :key="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Fase actual</label>
          <input v-model="form.fase" class="form-input" placeholder="ej: Diseño UI, Desarrollo backend..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha inicio</label>
            <input v-model="form.fecha_inicio" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Entrega estimada</label>
            <input v-model="form.fecha_entrega_estimada" type="date" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label>Fecha entrega real (si completado)</label>
          <input v-model="form.fecha_entrega_real" type="date" class="form-input" />
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showProyModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveProyecto" :disabled="saving || !form.nombre">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Horas disponibles del usuario -->
    <div class="modal-overlay" v-if="showUsuarioModal" @click.self="showUsuarioModal = false">
      <div class="modal-box">
        <p class="modal-title">Horas disponibles por semana</p>
        <p class="modal-hint">Ajusta la capacidad semanal de este usuario. La carga real se calcula automáticamente desde las tareas asignadas.</p>
        <div class="form-group">
          <label>Horas disponibles / semana</label>
          <input v-model.number="usuarioHoras" type="number" min="1" max="60" class="form-input" />
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showUsuarioModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveUsuario" :disabled="savingUsuario">
            {{ savingUsuario ? 'Guardando...' : 'Guardar' }}
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

.btn-edit-action { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.btn-edit-action:hover { border-color: var(--color-primary); color: var(--color-primary); }

.projects-list { display: flex; flex-direction: column; gap: 0.75rem; }
.project-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 0.85rem; background: rgba(255,255,255,0.02); border-radius: 8px; gap: 1rem; }
.project-info { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
.project-name { font-weight: 600; }
.project-meta { font-size: 0.82rem; color: var(--color-text-muted); }
.project-dates { font-size: 0.78rem; color: var(--color-text-muted); }
.project-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }

.estado-select { background: transparent; border: 1px solid var(--color-border); border-radius: 12px; padding: 0.25rem 0.5rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; outline: none; color-scheme: dark; }

.team-grid { display: flex; flex-direction: column; gap: 1.25rem; }
.member-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-weight: 500; }
.member-actions { display: flex; align-items: center; gap: 0.35rem; }
.member-hours { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.25rem; }
.load-bar-bg { width: 100%; height: 8px; background: #333; border-radius: 4px; overflow: hidden; }
.load-bar-fill { height: 100%; transition: width 0.4s; }

.empty-state { color: var(--color-text-muted); text-align: center; padding: 2rem; font-style: italic; }
.row-actions { display: flex; gap: 0.5rem; }
.btn-icon-text { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.25rem; border-radius: 4px; }
.btn-icon-text:hover { background: rgba(255,255,255,0.1); }
.btn-icon-text.danger:hover { background: rgba(255,68,68,0.15); }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 520px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-hint { font-size: 0.85rem; color: var(--color-text-muted); margin: -0.5rem 0 1.25rem; line-height: 1.5; }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background-color: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 600px) {
  .project-item { flex-direction: column; align-items: flex-start; }
  .project-right { width: 100%; align-items: flex-start; margin-top: 0.5rem; }
  .estado-select { width: 100%; }
}
</style>
