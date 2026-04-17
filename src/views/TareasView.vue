<template>
  <div class="tareas-view">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">Tablero de Tareas</h1>
        <span v-if="pendingCount > 0" class="pending-badge">{{ pendingCount }} pendiente{{ pendingCount !== 1 ? 's' : '' }}</span>
      </div>
      <button class="btn-primary" @click="openCreateModal('backlog')">
        + Nueva Tarea
      </button>
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
            <span
              class="column-label"
              :class="{ 'dark-text': col.key === 'en_progreso' }"
              :style="col.key === 'en_progreso' ? { background: col.color, color: '#000' } : {}"
            >{{ col.label }}</span>
          </div>
          <span class="count-badge">{{ getColumnTareas(col.key).length }}</span>
        </div>

        <!-- Cards List -->
        <div class="cards-list">
          <div
            v-for="tarea in getColumnTareas(col.key)"
            :key="tarea.id"
            class="task-card"
            @click="openEditModal(tarea)"
          >
            <!-- Card Top Row -->
            <div class="card-top-row">
              <span
                class="priority-badge"
                :style="{ background: PRIORIDAD_COLOR[tarea.prioridad] + '22', color: PRIORIDAD_COLOR[tarea.prioridad], borderColor: PRIORIDAD_COLOR[tarea.prioridad] + '55' }"
              >{{ tarea.prioridad }}</span>
              <button
                class="delete-btn"
                title="Eliminar tarea"
                @click.stop="confirmDelete(tarea)"
              >×</button>
            </div>

            <!-- Title -->
            <div class="card-title">{{ tarea.titulo }}</div>

            <!-- Meta info -->
            <div class="card-meta">
              <span v-if="tarea.proyectos?.nombre" class="meta-tag project-tag">
                {{ tarea.proyectos.nombre }}
              </span>
              <span v-if="tarea.horas_estimadas && tarea.horas_estimadas > 0" class="meta-tag hours-tag">
                {{ tarea.horas_estimadas }}h
              </span>
              <span
                v-if="tarea.fecha_limite"
                class="meta-tag date-tag"
                :class="{ 'overdue': isOverdue(tarea.fecha_limite) }"
              >
                {{ formatDate(tarea.fecha_limite) }}
              </span>
            </div>

            <!-- Move Buttons -->
            <div class="card-actions" @click.stop>
              <button
                class="move-btn"
                :disabled="getColumnIndex(col.key) === 0"
                title="Mover a la izquierda"
                @click.stop="moveCard(tarea, 'left')"
              >←</button>
              <button
                class="move-btn"
                :disabled="getColumnIndex(col.key) === COLUMNAS.length - 1"
                title="Mover a la derecha"
                @click.stop="moveCard(tarea, 'right')"
              >→</button>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="getColumnTareas(col.key).length === 0" class="empty-column">
            Sin tareas
          </div>
        </div>

        <!-- Add button -->
        <button class="add-card-btn" @click="openCreateModal(col.key)">
          + Agregar tarea
        </button>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">{{ isEditing ? 'Editar Tarea' : 'Nueva Tarea' }}</h2>
            <button class="modal-close" @click="closeModal">×</button>
          </div>

          <form class="modal-form" @submit.prevent="submitForm">
            <!-- Título -->
            <div class="form-group">
              <label class="form-label">Título <span class="required">*</span></label>
              <input
                v-model="form.titulo"
                class="form-input"
                type="text"
                placeholder="Nombre de la tarea"
                required
                autofocus
              />
            </div>

            <!-- Descripción -->
            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea
                v-model="form.descripcion"
                class="form-input form-textarea"
                placeholder="Descripción opcional"
                rows="3"
              ></textarea>
            </div>

            <!-- Estado & Prioridad row -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Estado</label>
                <select v-model="form.estado" class="form-input form-select">
                  <option v-for="col in COLUMNAS" :key="col.key" :value="col.key">
                    {{ col.label }}
                  </option>
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

            <!-- Proyecto -->
            <div class="form-group">
              <label class="form-label">Proyecto</label>
              <select v-model="form.proyecto_id" class="form-input form-select">
                <option :value="null">Sin proyecto</option>
                <option v-for="p in proyectos" :key="p.id" :value="p.id">
                  {{ p.nombre }}
                </option>
              </select>
            </div>

            <!-- Horas & Fecha row -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Horas estimadas</label>
                <input
                  v-model.number="form.horas_estimadas"
                  class="form-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha límite</label>
                <input
                  v-model="form.fecha_limite"
                  class="form-input"
                  type="date"
                />
              </div>
            </div>

            <!-- Buttons -->
            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear tarea') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTareas, createTarea, updateTarea, deleteTarea, COLUMNAS, PRIORIDAD_COLOR } from '../services/tareas'
import type { Tarea, TareaEstado, TareaPrioridad } from '../services/tareas'
import { useToast } from '../composables/useToast'
import { supabase } from '../supabase'

const { tareas } = useTareas()

async function refresh() {
  const { data } = await supabase
    .from('tareas')
    .select('*, proyectos(nombre), leads(empresa), usuarios!tareas_asignado_a_fkey(nombre)')
    .order('created_at', { ascending: false })
  if (data) tareas.value = data as any
}
const { success, error } = useToast()

// ── Projects for select ──────────────────────────────────────────────────────
interface Proyecto { id: string; nombre: string }
const proyectos = ref<Proyecto[]>([])

onMounted(async () => {
  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre')
    .neq('estado', 'Completado')
  if (data) proyectos.value = data
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function getColumnTareas(key: string): Tarea[] {
  return tareas.value.filter(t => t.estado === key)
}

function getColumnIndex(key: string): number {
  return COLUMNAS.findIndex(c => c.key === key)
}

const pendingCount = computed(() =>
  tareas.value.filter(t => t.estado === 'backlog').length
)

function isOverdue(date: string): boolean {
  return new Date(date) < new Date(new Date().toDateString())
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// ── Move cards ───────────────────────────────────────────────────────────────
async function moveCard(tarea: Tarea, direction: 'left' | 'right') {
  const idx = getColumnIndex(tarea.estado)
  const newIdx = direction === 'left' ? idx - 1 : idx + 1
  if (newIdx < 0 || newIdx >= COLUMNAS.length) return
  const newEstado = COLUMNAS[newIdx]!.key as TareaEstado
  try {
    await updateTarea(tarea.id, { estado: newEstado })
    await refresh()
    success('Tarea movida')
  } catch {
    error('Error al mover la tarea')
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────
async function confirmDelete(tarea: Tarea) {
  if (!confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) return
  try {
    await deleteTarea(tarea.id)
    await refresh()
    success('Tarea eliminada')
  } catch {
    error('Error al eliminar la tarea')
  }
}

// ── Modal state ──────────────────────────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

interface FormState {
  titulo: string
  descripcion: string
  estado: TareaEstado
  prioridad: TareaPrioridad
  proyecto_id: string | null
  horas_estimadas: number
  fecha_limite: string
}

const defaultForm = (): FormState => ({
  titulo: '',
  descripcion: '',
  estado: 'backlog' as TareaEstado,
  prioridad: 'Media' as TareaPrioridad,
  proyecto_id: null,
  horas_estimadas: 0,
  fecha_limite: '',
})

const form = ref<FormState>(defaultForm())

function openCreateModal(columnKey: string) {
  isEditing.value = false
  editingId.value = null
  form.value = { ...defaultForm(), estado: columnKey as TareaEstado }
  showModal.value = true
}

function openEditModal(tarea: Tarea) {
  isEditing.value = true
  editingId.value = tarea.id
  form.value = {
    titulo: tarea.titulo,
    descripcion: tarea.descripcion ?? '',
    estado: tarea.estado,
    prioridad: tarea.prioridad,
    proyecto_id: tarea.proyecto_id ?? null,
    horas_estimadas: tarea.horas_estimadas ?? 0,
    fecha_limite: tarea.fecha_limite ? tarea.fecha_limite.slice(0, 10) : '',
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  form.value = defaultForm()
  editingId.value = null
  isEditing.value = false
}

async function submitForm() {
  if (!form.value.titulo.trim()) return
  saving.value = true
  try {
    const payload = {
      titulo: form.value.titulo.trim(),
      descripcion: form.value.descripcion.trim() || null,
      estado: form.value.estado,
      prioridad: form.value.prioridad,
      proyecto_id: form.value.proyecto_id || null,
      horas_estimadas: form.value.horas_estimadas || 0,
      fecha_limite: form.value.fecha_limite || null,
    }
    if (isEditing.value && editingId.value) {
      await updateTarea(editingId.value, payload)
      success('Tarea actualizada')
    } else {
      await createTarea(payload)
      success('Tarea creada')
    }
    await refresh()
    closeModal()
  } catch {
    error('Error al guardar la tarea')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────────── */
.tareas-view {
  padding: 24px;
  min-height: 100vh;
  background: var(--color-bg-dark);
  color: var(--color-text-light);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Page Header ────────────────────────────────────────────────────────────── */
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

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-light);
}

.pending-badge {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 20px;
}

/* ── Kanban Board ───────────────────────────────────────────────────────────── */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  align-items: start;
  overflow-x: auto;
  padding-bottom: 8px;
}

/* ── Column ─────────────────────────────────────────────────────────────────── */
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
  padding: 2px 8px;
  border-radius: 4px;
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

/* ── Cards List ─────────────────────────────────────────────────────────────── */
.cards-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 60px;
}

.empty-column {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 20px 0;
  opacity: 0.6;
}

/* ── Task Card ──────────────────────────────────────────────────────────────── */
.task-card {
  background: var(--color-bg-dark);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.task-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary)22;
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
  padding: 0 2px;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
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

.hours-tag {
  background: #3b82f622;
  color: #60a5fa;
  border: 1px solid #3b82f644;
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

.card-actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.move-btn {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  line-height: 1.5;
}

.move-btn:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-bg-card);
}

.move-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

/* ── Add Card Button ────────────────────────────────────────────────────────── */
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

/* ── Buttons ────────────────────────────────────────────────────────────────── */
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

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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

.btn-secondary:hover {
  background: var(--color-bg-card);
}

/* ── Modal ──────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
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
  color: var(--color-text-light);
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

.modal-close:hover {
  color: var(--color-text-light);
}

/* ── Modal Form ─────────────────────────────────────────────────────────────── */
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

.required {
  color: #f87171;
}

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

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
  cursor: pointer;
}

.form-select option {
  background: var(--color-bg-card);
  color: var(--color-text-light);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

/* ── Responsive ─────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .tareas-view {
    padding: 16px;
  }

  .kanban-board {
    grid-template-columns: 1fr;
    overflow-x: unset;
  }

  .kanban-column {
    min-width: unset;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
