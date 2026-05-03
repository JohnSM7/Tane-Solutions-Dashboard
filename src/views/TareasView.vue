<template>
  <div class="tareas-view">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Tablero de Tareas</h1>
        <span v-if="pendingCount > 0" class="pending-badge">
          {{ pendingCount }} pendiente{{ pendingCount !== 1 ? 's' : '' }}
        </span>
      </div>
      <div class="header-actions">
        <button
          class="btn-toggle"
          :class="{ active: misTareasFilter }"
          @click="misTareasFilter = !misTareasFilter"
        >
          {{ misTareasFilter ? 'Mis tareas' : 'Todas las tareas' }}
        </button>
        <button class="btn-primary" @click="openCreateModal('backlog')">+ Nueva Tarea</button>
      </div>
    </div>

    <!-- Kanban Board -->
    <div class="kanban-board">
      <div
        v-for="col in COLUMNAS"
        :key="col.key"
        class="kanban-column"
        :style="{ '--col-color': col.color }"
      >
        <!-- Column Header -->
        <div class="column-header">
          <div class="column-header-left">
            <span class="color-dot" :style="{ background: col.color }"></span>
            <span class="column-label">{{ col.label }}</span>
          </div>
          <span class="count-badge">{{ getColumnTareas(col.key).length }}</span>
        </div>

        <!-- Drop Zone -->
        <div
          class="cards-list"
          :class="{ 'drag-over': dragOverColumn === col.key }"
          @dragover.prevent="dragOverColumn = col.key"
          @dragleave="onDragLeave(col.key, $event)"
          @drop.prevent="onDrop(col.key)"
        >
          <div
            v-for="tarea in getColumnTareas(col.key)"
            :key="tarea.id"
            class="task-card"
            :class="{ dragging: draggedId === tarea.id }"
            draggable="true"
            @dragstart="onDragStart(tarea.id)"
            @dragend="draggedId = null; dragOverColumn = null"
            @click="openPanel(tarea)"
          >
            <!-- Top row -->
            <div class="card-top-row">
              <span
                class="priority-badge"
                :style="{
                  background: PRIORIDAD_COLOR[tarea.prioridad] + '22',
                  color: PRIORIDAD_COLOR[tarea.prioridad],
                  borderColor: PRIORIDAD_COLOR[tarea.prioridad] + '55',
                }"
              >{{ tarea.prioridad }}</span>
              <button class="delete-btn" title="Eliminar tarea" @click.stop="confirmDelete(tarea)">×</button>
            </div>

            <!-- Title -->
            <div class="card-title">{{ tarea.titulo }}</div>

            <!-- Meta -->
            <div class="card-meta">
              <span v-if="tarea.proyectos?.nombre" class="meta-tag project-tag">{{ tarea.proyectos.nombre }}</span>
              <span v-if="tarea.horas_estimadas && tarea.horas_estimadas > 0" class="meta-tag hours-tag estimated">
                {{ tarea.horas_estimadas }}h est.
              </span>
              <span v-if="horasRealesMap.get(tarea.id)" class="meta-tag hours-tag real">
                {{ horasRealesMap.get(tarea.id) }}h real
              </span>
              <span
                v-if="tarea.fecha_limite"
                class="meta-tag date-tag"
                :class="{ overdue: isOverdue(tarea.fecha_limite) }"
              >{{ formatDate(tarea.fecha_limite) }}</span>
              <span v-if="tarea.es_recurrente && tarea.frecuencia_recurrencia" class="meta-tag recurrent-tag">
                ↻ {{ FRECUENCIA_LABELS[tarea.frecuencia_recurrencia] }}
              </span>
            </div>

            <!-- Assignee -->
            <div v-if="tarea.asignado_a" class="card-footer">
              <span class="assignee-badge" :title="getUsuarioNombre(tarea.asignado_a)">
                {{ getUsuarioInitials(tarea.asignado_a) }}
              </span>
            </div>
          </div>

          <div v-if="getColumnTareas(col.key).length === 0" class="empty-column">
            Arrastra aquí
          </div>
        </div>

        <button class="add-card-btn" @click="openCreateModal(col.key)">+ Agregar tarea</button>
      </div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Nueva Tarea</h2>
            <button class="modal-close" @click="closeModal">×</button>
          </div>
          <form class="modal-form" @submit.prevent="submitForm">
            <div class="form-group">
              <label class="form-label">Título <span class="required">*</span></label>
              <input v-model="form.titulo" class="form-input" type="text" placeholder="Nombre de la tarea" required autofocus />
            </div>
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea v-model="form.descripcion" class="form-input form-textarea" placeholder="Descripción opcional" rows="3"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Estado</label>
                <select v-model="form.estado" class="form-input form-select">
                  <option v-for="col in COLUMNAS" :key="col.key" :value="col.key">{{ col.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Prioridad</label>
                <select v-model="form.prioridad" class="form-input form-select">
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Proyecto</label>
              <select v-model="form.proyecto_id" class="form-input form-select">
                <option :value="null">Sin proyecto</option>
                <option v-for="p in proyectos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Asignado a</label>
              <select v-model="form.asignado_a" class="form-input form-select">
                <option :value="null">Sin asignar</option>
                <option v-for="u in equipo" :key="u.id" :value="u.id">{{ u.nombre }}</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Horas estimadas</label>
                <input v-model.number="form.horas_estimadas" class="form-input" type="number" min="0" step="0.5" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha límite</label>
                <input v-model="form.fecha_limite" class="form-input" type="date" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Recurrencia</label>
              <div class="recurrencia-row">
                <button
                  type="button"
                  class="toggle-recurrencia"
                  :class="{ active: form.es_recurrente }"
                  @click="form.es_recurrente = !form.es_recurrente"
                >↻ {{ form.es_recurrente ? 'Recurrente' : 'Sin recurrencia' }}</button>
                <select v-if="form.es_recurrente" v-model="form.frecuencia_recurrencia" class="form-input form-select recurrencia-freq">
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <p v-if="form.es_recurrente && !form.fecha_limite" class="recurrencia-hint">Necesita fecha límite para generar instancias</p>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Guardando...' : 'Crear tarea' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete dialog for recurring tasks -->
      <div v-if="deleteDialogTarea" class="modal-overlay">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h2 class="modal-title">Eliminar tarea recurrente</h2>
            <button class="modal-close" @click="deleteDialogTarea = null">×</button>
          </div>
          <div class="delete-dialog-body">
            <p class="delete-dialog-msg">¿Cómo deseas eliminar <strong>{{ deleteDialogTarea.titulo }}</strong>?</p>
            <div class="delete-dialog-actions">
              <button class="btn-secondary" @click="deleteDialogTarea = null">Cancelar</button>
              <button class="btn-danger" @click="deleteOnlyThis">Solo esta</button>
              <button class="btn-danger" @click="deleteThisAndFuture">Esta y las siguientes</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Task Detail Panel -->
      <TaskDetailPanel
        v-if="panelTarea"
        :tarea="panelTarea"
        :equipo="equipo"
        :proyectos="proyectos"
        :current-user-id="currentUserId"
        :current-user-nombre="currentUserNombre"
        @close="panelTarea = null"
        @updated="onPanelUpdated"
        @deleted="onPanelDeleted"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTareas, createTarea, createTareaRecurrente, deleteTarea, deleteTareasFromDate, COLUMNAS, PRIORIDAD_COLOR, updateTarea, FRECUENCIA_LABELS } from '../services/tareas'
import type { Tarea, TareaEstado, TareaPrioridad, FrecuenciaRecurrencia } from '../services/tareas'
import { useToast } from '../composables/useToast'
import { supabase } from '../supabase'
import TaskDetailPanel from '../components/TaskDetailPanel.vue'

const { tareas } = useTareas()
const { success, error } = useToast()

// ── Current user ──────────────────────────────────────────────────────────────
const currentUserId = ref<string | null>(null)
const currentUserNombre = ref('')

// ── Filter ────────────────────────────────────────────────────────────────────
const misTareasFilter = ref(false)

// ── Team members ──────────────────────────────────────────────────────────────
interface UsuarioAdmin { id: string; nombre: string }
const equipo = ref<UsuarioAdmin[]>([])
const usuarioMap = ref(new Map<string, string>())

// ── Projects ──────────────────────────────────────────────────────────────────
interface Proyecto { id: string; nombre: string }
const proyectos = ref<Proyecto[]>([])

// ── Horas reales per tarea ────────────────────────────────────────────────────
const horasRealesMap = ref(new Map<string, number>())

onMounted(async () => {
  const [userRes, equipoRes, proyectosRes, horasRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('usuarios').select('id, nombre').eq('rol', 'ADMIN').order('nombre'),
    supabase.from('proyectos').select('id, nombre').neq('estado', 'Completado'),
    supabase.from('registros_horas').select('tarea_id, horas').not('tarea_id', 'is', null),
  ])

  currentUserId.value = userRes.data.user?.id ?? null
  equipo.value = (equipoRes.data ?? []) as UsuarioAdmin[]
  usuarioMap.value = new Map(equipo.value.map(u => [u.id, u.nombre]))
  proyectos.value = (proyectosRes.data ?? []) as Proyecto[]

  // Nombre del usuario actual
  if (currentUserId.value) {
    currentUserNombre.value = usuarioMap.value.get(currentUserId.value) ?? 'Usuario'
  }

  const map = new Map<string, number>()
  for (const r of (horasRes.data ?? []) as any[]) {
    if (!r.tarea_id) continue
    map.set(r.tarea_id, (map.get(r.tarea_id) ?? 0) + Number(r.horas ?? 0))
  }
  horasRealesMap.value = map
})

async function refresh() {
  const { data } = await supabase
    .from('tareas')
    .select('*, proyectos(nombre), leads(empresa), usuarios!tareas_asignado_a_fkey(nombre)')
    .order('created_at', { ascending: false })
  if (data) tareas.value = data as any

  const { data: horasData } = await supabase
    .from('registros_horas')
    .select('tarea_id, horas')
    .not('tarea_id', 'is', null)
  const map = new Map<string, number>()
  for (const r of (horasData ?? []) as any[]) {
    if (!r.tarea_id) continue
    map.set(r.tarea_id, (map.get(r.tarea_id) ?? 0) + Number(r.horas ?? 0))
  }
  horasRealesMap.value = map
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getColumnTareas(key: string): Tarea[] {
  let list = tareas.value.filter(t => t.estado === key)
  if (misTareasFilter.value && currentUserId.value) {
    list = list.filter(t => t.asignado_a === currentUserId.value)
  }
  return list
}

function getUsuarioNombre(id: string): string {
  return usuarioMap.value.get(id) ?? 'Usuario'
}

function getUsuarioInitials(id: string): string {
  return getUsuarioNombre(id)
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const pendingCount = computed(() => {
  if (misTareasFilter.value && currentUserId.value) {
    return tareas.value.filter(t => t.estado === 'backlog' && t.asignado_a === currentUserId.value).length
  }
  return tareas.value.filter(t => t.estado === 'backlog').length
})

function isOverdue(date: string): boolean {
  return new Date(date) < new Date(new Date().toDateString())
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// ── Drag and Drop ─────────────────────────────────────────────────────────────
const draggedId = ref<string | null>(null)
const dragOverColumn = ref<string | null>(null)

function onDragStart(tareaId: string) {
  draggedId.value = tareaId
}

function onDragLeave(colKey: string, event: DragEvent) {
  const target = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !target.contains(related)) {
    if (dragOverColumn.value === colKey) dragOverColumn.value = null
  }
}

async function onDrop(targetEstado: string) {
  dragOverColumn.value = null
  if (!draggedId.value) return
  const tarea = tareas.value.find(t => t.id === draggedId.value)
  if (!tarea || tarea.estado === targetEstado) {
    draggedId.value = null
    return
  }
  const id = draggedId.value
  draggedId.value = null
  try {
    await updateTarea(id, { estado: targetEstado as TareaEstado })
    await refresh()
    success('Tarea movida')
  } catch {
    error('Error al mover la tarea')
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteDialogTarea = ref<Tarea | null>(null)

async function confirmDelete(tarea: Tarea) {
  if (tarea.es_recurrente && tarea.recurrencia_id) {
    deleteDialogTarea.value = tarea
    return
  }
  if (!confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) return
  try {
    await deleteTarea(tarea.id)
    await refresh()
    success('Tarea eliminada')
  } catch {
    error('Error al eliminar la tarea')
  }
}

async function deleteOnlyThis() {
  const tarea = deleteDialogTarea.value
  if (!tarea) return
  deleteDialogTarea.value = null
  try {
    await deleteTarea(tarea.id)
    await refresh()
    if (panelTarea.value?.id === tarea.id) panelTarea.value = null
    success('Tarea eliminada')
  } catch {
    error('Error al eliminar la tarea')
  }
}

async function deleteThisAndFuture() {
  const tarea = deleteDialogTarea.value
  if (!tarea || !tarea.recurrencia_id || !tarea.fecha_limite) return
  deleteDialogTarea.value = null
  try {
    await deleteTareasFromDate(tarea.recurrencia_id, tarea.fecha_limite)
    await refresh()
    if (panelTarea.value?.recurrencia_id === tarea.recurrencia_id) panelTarea.value = null
    success('Tareas eliminadas')
  } catch {
    error('Error al eliminar las tareas')
  }
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
const panelTarea = ref<Tarea | null>(null)

function openPanel(tarea: Tarea) {
  panelTarea.value = tarea
}

function onPanelUpdated(updated: Tarea) {
  const idx = tareas.value.findIndex(t => t.id === updated.id)
  if (idx !== -1) {
    // preserve joins from existing entry
    tareas.value[idx] = { ...tareas.value[idx], ...updated }
  }
  panelTarea.value = tareas.value[idx] ?? updated
  success('Tarea actualizada')
}

function onPanelDeleted(id: string) {
  tareas.value = tareas.value.filter(t => t.id !== id)
  panelTarea.value = null
  success('Tarea eliminada')
}

// ── Create Modal ──────────────────────────────────────────────────────────────
const showModal = ref(false)
const saving = ref(false)

interface FormState {
  titulo: string
  descripcion: string
  estado: TareaEstado
  prioridad: TareaPrioridad
  proyecto_id: string | null
  asignado_a: string | null
  horas_estimadas: number
  fecha_limite: string
  es_recurrente: boolean
  frecuencia_recurrencia: FrecuenciaRecurrencia
}

const defaultForm = (): FormState => ({
  titulo: '',
  descripcion: '',
  estado: 'backlog' as TareaEstado,
  prioridad: 'Media' as TareaPrioridad,
  proyecto_id: null,
  asignado_a: null,
  horas_estimadas: 0,
  fecha_limite: '',
  es_recurrente: false,
  frecuencia_recurrencia: 'semanal',
})

const form = ref<FormState>(defaultForm())

function openCreateModal(columnKey: string) {
  form.value = { ...defaultForm(), estado: columnKey as TareaEstado }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  form.value = defaultForm()
}

async function submitForm() {
  if (!form.value.titulo.trim()) return
  saving.value = true
  try {
    const basePayload = {
      titulo:          form.value.titulo.trim(),
      descripcion:     form.value.descripcion.trim() || null,
      estado:          form.value.estado,
      prioridad:       form.value.prioridad,
      proyecto_id:     form.value.proyecto_id || null,
      asignado_a:      form.value.asignado_a || null,
      horas_estimadas: form.value.horas_estimadas || 0,
      fecha_limite:    form.value.fecha_limite || null,
    }

    if (form.value.es_recurrente) {
      if (!form.value.fecha_limite) {
        error('La tarea recurrente necesita una fecha límite')
        saving.value = false
        return
      }
      await createTareaRecurrente(basePayload, form.value.frecuencia_recurrencia)
      await refresh()
      closeModal()
      success(`Tarea recurrente (${FRECUENCIA_LABELS[form.value.frecuencia_recurrencia]}) creada`)
    } else {
      const created = await createTarea(basePayload)
      await refresh()
      closeModal()
      const nueva = tareas.value.find(t => t.id === created.id) ?? created
      panelTarea.value = nueva
      success('Tarea creada')
    }
  } catch {
    error('Error al crear la tarea')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────────── */
.tareas-view {
  padding: 24px;
  min-height: 100vh;
  background: var(--color-bg-dark);
  color: var(--color-text-light);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Page Header ───────────────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.pending-badge {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 20px;
}

.btn-toggle {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.btn-toggle:hover {
  color: var(--color-text-light);
  border-color: var(--color-primary);
}

.btn-toggle.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #000;
  font-weight: 600;
}

/* ── Kanban Board ──────────────────────────────────────────────────────────── */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
  overflow-x: auto;
  padding-bottom: 8px;
}

.kanban-column {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--col-color);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-width: 240px;
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.column-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.column-label {
  font-weight: 600;
  font-size: 0.875rem;
}

.count-badge {
  background: var(--color-bg-lighter);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  min-width: 24px;
  text-align: center;
}

/* ── Cards List / Drop Zone ────────────────────────────────────────────────── */
.cards-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 80px;
  transition: background 0.15s;
}

.cards-list.drag-over {
  background: var(--color-primary)11;
  outline: 2px dashed var(--color-primary)66;
  outline-offset: -4px;
}

.empty-column {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 20px 0;
  opacity: 0.5;
}

/* ── Task Card ─────────────────────────────────────────────────────────────── */
.task-card {
  background: var(--color-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
  display: flex;
  flex-direction: column;
  gap: 7px;
  user-select: none;
}

.task-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary)22;
}

.task-card.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.priority-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 3px;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.delete-btn:hover {
  color: #f87171;
  background: #f8717122;
}

.card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-light);
  line-height: 1.4;
  word-break: break-word;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.meta-tag {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 500;
}

.project-tag {
  background: var(--color-bg-lighter);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hours-tag.estimated {
  background: #3b82f622;
  color: #93c5fd;
  border: 1px solid #3b82f644;
}

.hours-tag.real {
  background: #10b98122;
  color: #34d399;
  border: 1px solid #10b98144;
}

.date-tag {
  background: var(--color-bg-lighter);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.date-tag.overdue {
  background: #ef444422;
  color: #f87171;
  border-color: #ef444455;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
}

.assignee-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #000;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: default;
}

/* ── Add Card Button ───────────────────────────────────────────────────────── */
.add-card-btn {
  width: 100%;
  background: none;
  border: none;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 10px 14px;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s, background 0.15s;
}

.add-card-btn:hover {
  background: var(--color-bg-lighter);
  color: var(--color-primary);
}

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.btn-primary {
  background: var(--color-primary);
  color: #000;
  border: none;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: var(--color-bg-lighter);
  color: var(--color-text-light);
  border: 1px solid var(--color-border);
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover { background: var(--color-bg-card); }

/* ── Modal ─────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  padding: 16px;
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s;
}

.modal-close:hover { color: var(--color-text-light); }

.modal-form {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.required { color: #f87171; }

.form-input {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 9px 12px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
  font-family: inherit;
}

.form-input:focus { outline: none; border-color: var(--color-primary); }
.form-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }
.form-textarea { resize: vertical; min-height: 80px; }

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
  cursor: pointer;
}

.form-select option { background: var(--color-bg-card); color: var(--color-text-light); }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

/* ── Recurrencia ───────────────────────────────────────────────────────────── */
.recurrencia-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.toggle-recurrencia {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.82rem;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
  font-family: inherit;
}

.toggle-recurrencia:hover {
  color: var(--color-text-light);
  border-color: var(--color-primary);
}

.toggle-recurrencia.active {
  background: var(--color-primary)22;
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.recurrencia-freq {
  flex: 1;
  min-width: 120px;
}

.recurrencia-hint {
  font-size: 0.75rem;
  color: #ffa500;
  margin: 0;
}

/* ── Recurrent badge ───────────────────────────────────────────────────────── */
.recurrent-tag {
  background: var(--color-primary)18;
  color: var(--color-primary);
  border: 1px solid var(--color-primary)44;
  font-weight: 600;
}

/* ── Delete dialog ─────────────────────────────────────────────────────────── */
.modal-sm {
  max-width: 400px;
}

.delete-dialog-body {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.delete-dialog-msg {
  font-size: 0.9rem;
  color: var(--color-text-light);
  margin: 0;
  line-height: 1.5;
}

.delete-dialog-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-danger {
  background: #ef444422;
  color: #f87171;
  border: 1px solid #ef444455;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.btn-danger:hover { background: #ef444444; }

/* ── Responsive ────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .tareas-view { padding: 16px; }

  .kanban-board {
    grid-template-columns: 1fr;
    overflow-x: unset;
  }

  .kanban-column { min-width: unset; }
  .form-row { grid-template-columns: 1fr; }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
