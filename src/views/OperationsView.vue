<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import {
  useOperationsData, createProyecto, updateProyecto, deleteProyecto,
  updateUsuario,
  ESTADO_COLORS, type Proyecto, type UsuarioAdmin,
} from '../services/operations';
import { useClientsList } from '../services/clients';
import { useLeadsList } from '../services/commercial';
import {
  useTareas, createTarea, updateTarea, deleteTarea,
  COLUMNAS, PRIORIDAD_COLOR, type Tarea, type TareaEstado,
} from '../services/tareas';

const { proyectos, equipo, teamLoad, kpis, loading } = useOperationsData();
const { clients } = useClientsList();
const { leads } = useLeadsList();
const { tareas, loading: loadingTareas } = useTareas();

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

    if (editingId.value) {
      const updated = await updateProyecto(editingId.value, payload);
      const idx = proyectos.value.findIndex(p => p.id === editingId.value);
      if (idx !== -1) proyectos.value[idx] = updated;
    } else {
      const created = await createProyecto(payload);
      proyectos.value.unshift(created);
    }
    showProyModal.value = false;
  } catch (error: any) {
    console.error('[saveProyecto] Error:', error);
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
    console.error('[removeProyecto] Error:', error);
    alert('Error al eliminar el proyecto: ' + (error.message || 'Error desconocido'));
  }
};

const changeEstado = async (p: Proyecto, estado: string) => {
  try {
    const updates: Partial<Proyecto> = { estado: estado as Proyecto['estado'] };
    if (estado === 'Completado') updates.fecha_entrega_real = new Date().toISOString().split('T')[0];
    const updated = await updateProyecto(p.id, updates);
    const idx = proyectos.value.findIndex(x => x.id === p.id);
    if (idx !== -1) proyectos.value[idx] = updated;
  } catch (error: any) {
    console.error('[changeEstado] Error:', error);
    alert('Error al cambiar el estado del proyecto: ' + (error.message || 'Error desconocido'));
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
    console.error('[saveUsuario] Error:', error);
    alert('Error al actualizar el usuario: ' + (error.message || 'Error desconocido'));
  } finally {
    savingUsuario.value = false;
  }
};

const formatDate = (d?: string | null) => d
  ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' })
  : '—';

// ── Kanban ────────────────────────────────────────────────────────────────────
const draggingId    = ref<string | null>(null);
const dragOverCol   = ref<TareaEstado | null>(null);

const tareasPorColumna = computed(() => {
  const map: Record<TareaEstado, Tarea[]> = {
    backlog: [], en_progreso: [], revision: [], completado: [],
  };
  for (const t of tareas.value) map[t.estado]?.push(t);
  return map;
});

const onDragStart = (id: string) => { draggingId.value = id; };
const onDragOver  = (col: TareaEstado) => { dragOverCol.value = col; };
const onDragEnd   = () => { draggingId.value = null; dragOverCol.value = null; };

const onDrop = async (col: TareaEstado) => {
  const tarea = tareas.value.find(t => t.id === draggingId.value);
  if (!tarea || tarea.estado === col) { onDragEnd(); return; }
  const prev = tarea.estado;
  tarea.estado = col;                       // optimistic
  try {
    const updated = await updateTarea(tarea.id, { estado: col });
    updated.proyectos = tarea.proyectos;
    updated.leads     = tarea.leads;
    updated.usuarios  = tarea.usuarios;
    Object.assign(tarea, updated);
  } catch (e) {
    tarea.estado = prev;                    // revert on error
    console.error(e);
  }
  onDragEnd();
};

// Horas pendientes por miembro calculadas desde tareas (excluye completado)
const horasPendientesMiembro = computed(() => {
  const map = new Map<string, number>();
  for (const t of tareas.value) {
    if (t.estado === 'completado' || !t.asignado_a) continue;
    map.set(t.asignado_a, (map.get(t.asignado_a) ?? 0) + (t.horas_estimadas ?? 0));
  }
  return map;
});

// ── Modal tarea ───────────────────────────────────────────────────────────────
const showTareaModal  = ref(false);
const savingTarea     = ref(false);
const editingTareaId  = ref<string | null>(null);

const emptyTarea = (estado: TareaEstado = 'backlog'): Partial<Tarea> => ({
  titulo: '', descripcion: '', estado, prioridad: 'Media',
  proyecto_id: null, lead_id: null, asignado_a: null,
  horas_estimadas: 0, fecha_limite: '',
});
const tareaForm = ref<Partial<Tarea>>(emptyTarea());

const openNewTarea = (estado: TareaEstado = 'backlog') => {
  tareaForm.value = emptyTarea(estado); editingTareaId.value = null; showTareaModal.value = true;
};
const openEditTarea = (t: Tarea) => {
  tareaForm.value = { ...t }; editingTareaId.value = t.id; showTareaModal.value = true;
};

const saveTarea = async () => {
  savingTarea.value = true;
  try {
    const payload = { ...tareaForm.value };
    if (!payload.proyecto_id) payload.proyecto_id = null;
    if (!payload.lead_id)     payload.lead_id = null;
    if (!payload.asignado_a)  payload.asignado_a = null;
    if (!payload.fecha_limite) payload.fecha_limite = null;

    if (editingTareaId.value) {
      const updated = await updateTarea(editingTareaId.value, payload);
      // Preservar joins (PATCH solo devuelve *, sin joins — evita PGRST204)
      updated.proyectos = resolveProyecto(updated.proyecto_id);
      updated.leads     = resolveLead(updated.lead_id);
      updated.usuarios  = resolveUsuario(updated.asignado_a);
      const idx = tareas.value.findIndex(t => t.id === editingTareaId.value);
      if (idx !== -1) tareas.value[idx] = updated;
    } else {
      const created = await createTarea(payload);
      created.proyectos = resolveProyecto(created.proyecto_id);
      created.leads     = resolveLead(created.lead_id);
      created.usuarios  = resolveUsuario(created.asignado_a);
      tareas.value.unshift(created);
    }
    showTareaModal.value = false;
  } catch (error: any) {
    console.error('[saveTarea] Error:', error);
    alert('Error al guardar la tarea: ' + (error.message || 'Error desconocido'));
  } finally {
    savingTarea.value = false;
  }
};

const removeTarea = async (t: Tarea) => {
  if (!confirm(`¿Eliminar "${t.titulo}"?`)) return;
  try {
    await deleteTarea(t.id);
    tareas.value = tareas.value.filter(x => x.id !== t.id);
  } catch (error: any) {
    console.error('[removeTarea] Error:', error);
    alert('Error al eliminar la tarea: ' + (error.message || 'Error desconocido'));
  }
};

const resolveProyecto = (id?: string | null) => {
  const p = proyectos.value.find(x => x.id === id);
  return p ? { nombre: p.nombre } : null;
};
const resolveLead = (id?: string | null) => {
  const l = leads.value.find(x => x.id === id);
  return l ? { empresa: l.empresa } : null;
};
const resolveUsuario = (id?: string | null) => {
  const u = equipo.value.find(x => x.id === id);
  return u ? { nombre: u.nombre } : null;
};

const iniciales = (nombre?: string | null) =>
  nombre ? nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';

const isOverdue = (t: Tarea) =>
  t.fecha_limite && t.estado !== 'completado' && new Date(t.fecha_limite) < new Date();
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo de Operaciones</h1>
      <span class="subtitle">Gestión de Proyectos</span>
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

      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <!-- KANBAN DE TAREAS                                                    -->
      <!-- ═══════════════════════════════════════════════════════════════════ -->
      <div class="kanban-header-row">
        <div>
          <h2 class="kanban-title">Tablero de Tareas</h2>
          <span class="kanban-subtitle">{{ tareas.length }} tarea{{ tareas.length !== 1 ? 's' : '' }} en total</span>
        </div>
        <button class="btn-edit-action" @click="openNewTarea()">+ Nueva Tarea</button>
      </div>

      <div v-if="loadingTareas" class="loading-state">Cargando tareas...</div>

      <div v-else class="kanban-board">
        <div
          v-for="col in COLUMNAS"
          :key="col.key"
          class="kanban-col"
          :class="{ 'drag-over': dragOverCol === col.key }"
          @dragover.prevent="onDragOver(col.key)"
          @dragleave="dragOverCol = null"
          @drop.prevent="onDrop(col.key)"
        >
          <div class="col-header">
            <div class="col-title-row">
              <span class="col-dot" :style="{ background: col.color }"></span>
              <span class="col-label">{{ col.label }}</span>
              <span class="col-count">{{ tareasPorColumna[col.key].length }}</span>
            </div>
            <button class="btn-col-add" @click="openNewTarea(col.key)" title="Nueva tarea en esta columna">+</button>
          </div>
          <div class="col-cards">
            <div
              v-for="t in tareasPorColumna[col.key]"
              :key="t.id"
              class="tarea-card"
              :class="{ dragging: draggingId === t.id, overdue: isOverdue(t) }"
              draggable="true"
              @dragstart="onDragStart(t.id)"
              @dragend="onDragEnd"
              @click="openEditTarea(t)"
            >
              <div class="card-top">
                <span class="prioridad-dot" :style="{ background: PRIORIDAD_COLOR[t.prioridad] }" :title="t.prioridad"></span>
                <span v-if="t.proyectos" class="origin-chip project">{{ t.proyectos.nombre }}</span>
                <span v-else-if="t.leads" class="origin-chip lead">{{ t.leads.empresa }}</span>
              </div>
              <p class="card-titulo">{{ t.titulo }}</p>
              <div class="card-footer">
                <span v-if="t.usuarios" class="assignee-avatar" :title="t.usuarios.nombre">{{ iniciales(t.usuarios.nombre) }}</span>
                <span v-else class="assignee-avatar unassigned" title="Sin asignar">?</span>
                <div class="card-meta-right">
                  <span v-if="t.horas_estimadas" class="card-hours">{{ t.horas_estimadas }}h</span>
                  <span v-if="t.fecha_limite" class="card-date" :class="{ overdue: isOverdue(t) }">{{ formatDate(t.fecha_limite) }}</span>
                </div>
              </div>
            </div>
            <div v-if="tareasPorColumna[col.key].length === 0" class="col-empty">
              Arrastra aquí o <button class="btn-link-inline" @click="openNewTarea(col.key)">añade una tarea</button>
            </div>
          </div>
        </div>
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

    <!-- Modal: Tarea -->
    <div class="modal-overlay" v-if="showTareaModal" @click.self="showTareaModal = false">
      <div class="modal-box">
        <p class="modal-title">{{ editingTareaId ? 'Editar Tarea' : 'Nueva Tarea' }}</p>

        <div class="form-group">
          <label>Título *</label>
          <input v-model="tareaForm.titulo" class="form-input" placeholder="Describe la tarea..." />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea v-model="tareaForm.descripcion" class="form-input form-textarea" rows="2" placeholder="Detalles opcionales..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Prioridad</label>
            <select v-model="tareaForm.prioridad" class="form-input">
              <option>Baja</option><option>Media</option><option>Alta</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado</label>
            <select v-model="tareaForm.estado" class="form-input">
              <option v-for="c in COLUMNAS" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Proyecto vinculado</label>
            <select v-model="tareaForm.proyecto_id" class="form-input">
              <option :value="null">— Ninguno —</option>
              <option v-for="p in proyectos.filter(p => p.estado !== 'Completado')" :key="p.id" :value="p.id">{{ p.nombre }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lead vinculado</label>
            <select v-model="tareaForm.lead_id" class="form-input">
              <option :value="null">— Ninguno —</option>
              <option v-for="l in leads" :key="l.id" :value="l.id">{{ l.empresa }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Asignado a</label>
            <select v-model="tareaForm.asignado_a" class="form-input">
              <option :value="null">— Sin asignar —</option>
              <option v-for="m in equipo" :key="m.id" :value="m.id">{{ m.nombre }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Horas estimadas</label>
            <input v-model.number="tareaForm.horas_estimadas" type="number" min="0" step="0.5" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label>Fecha límite</label>
          <input v-model="tareaForm.fecha_limite" type="date" class="form-input" />
        </div>

        <div class="modal-actions">
          <button v-if="editingTareaId" class="btn-text danger-text" @click="removeTarea(tareaForm as Tarea); showTareaModal = false">Eliminar</button>
          <button class="btn-text" @click="showTareaModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveTarea" :disabled="savingTarea || !tareaForm.titulo">
            {{ savingTarea ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

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

.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
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
.muted { color: var(--color-text-muted); font-weight: 400; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 520px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
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

.modal-hint { font-size: 0.85rem; color: var(--color-text-muted); margin: -0.5rem 0 1.25rem; line-height: 1.5; }
.tareas-badge { color: var(--color-primary); font-weight: 600; }

@media (max-width: 600px) {
  .project-item { flex-direction: column; align-items: flex-start; }
  .project-right { width: 100%; align-items: flex-start; margin-top: 0.5rem; }
  .estado-select { width: 100%; }
}

/* ── Kanban ──────────────────────────────────────────────────────────────── */
.kanban-header-row {
  display: flex; justify-content: space-between; align-items: center;
}
.kanban-title { font-size: 1.3rem; font-weight: 700; margin: 0 0 0.2rem; }
.kanban-subtitle { font-size: 0.85rem; color: var(--color-text-muted); }

.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  align-items: start;
}

.kanban-col {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.85rem;
  min-height: 200px;
  transition: background 0.15s, border-color 0.15s;
}
.kanban-col.drag-over {
  background: rgba(227,255,4,0.05);
  border-color: var(--color-primary);
}

.col-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.85rem;
}
.col-title-row { display: flex; align-items: center; gap: 0.5rem; }
.col-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.col-label { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
.col-count {
  background: rgba(255,255,255,0.08); color: var(--color-text-muted);
  font-size: 0.72rem; font-weight: 700;
  padding: 0.1rem 0.45rem; border-radius: 10px;
}
.btn-col-add {
  background: none; border: 1px solid var(--color-border); color: var(--color-text-muted);
  width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 1rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.btn-col-add:hover { border-color: var(--color-primary); color: var(--color-primary); }

.col-cards { display: flex; flex-direction: column; gap: 0.6rem; }

.tarea-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  cursor: grab;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  user-select: none;
}
.tarea-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.3); transform: translateY(-1px); }
.tarea-card.dragging { opacity: 0.4; cursor: grabbing; }
.tarea-card.overdue { border-left: 3px solid #ff4444; }

.card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; min-height: 16px; }
.prioridad-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.origin-chip {
  font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.45rem;
  border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;
}
.origin-chip.project { background: rgba(227,255,4,0.1);  color: var(--color-primary); }
.origin-chip.lead    { background: rgba(96,165,250,0.12); color: #60a5fa; }

.card-titulo {
  font-size: 0.88rem; font-weight: 600; margin: 0 0 0.6rem;
  line-height: 1.3; color: var(--color-text-light);
}

.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.assignee-avatar {
  width: 24px; height: 24px; border-radius: 50%; background: rgba(227,255,4,0.2);
  color: var(--color-primary); font-size: 0.65rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.assignee-avatar.unassigned { background: rgba(255,255,255,0.07); color: var(--color-text-muted); }

.card-meta-right { display: flex; align-items: center; gap: 0.4rem; }
.card-hours { font-size: 0.72rem; color: var(--color-text-muted); }
.card-date  { font-size: 0.72rem; color: var(--color-text-muted); }
.card-date.overdue { color: #f87171; font-weight: 700; }

.col-empty {
  text-align: center; padding: 1.5rem 0.5rem;
  font-size: 0.82rem; color: var(--color-text-muted); font-style: italic;
}
.btn-link-inline {
  background: none; border: none; color: var(--color-primary);
  font-size: 0.82rem; cursor: pointer; padding: 0; text-decoration: underline;
}

.form-textarea { resize: vertical; min-height: 60px; }
.danger-text { color: #f87171; }

@media (max-width: 900px) {
  .kanban-board { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .kanban-board { grid-template-columns: 1fr; }
}
</style>
