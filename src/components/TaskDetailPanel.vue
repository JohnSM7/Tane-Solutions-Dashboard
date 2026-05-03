<template>
  <Teleport to="body">
    <div class="panel-backdrop">
      <div class="detail-panel">

        <!-- Header -->
        <div class="panel-header">
          <div class="panel-header-left">
            <button class="btn-back" @click="$emit('close')">←</button>
            <select v-model="draft.estado" class="estado-pill" :style="{ color: estadoColor }">
              <option v-for="col in COLUMNAS" :key="col.key" :value="col.key">{{ col.label }}</option>
            </select>
          </div>
          <button class="btn-delete-panel" title="Eliminar tarea" @click="handleDelete">Eliminar</button>
        </div>

        <!-- Scrollable body -->
        <div class="panel-body">

          <!-- Title -->
          <input v-model="draft.titulo" class="title-input" placeholder="Título de la tarea" />

          <!-- Meta grid -->
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Prioridad</span>
              <select v-model="draft.prioridad" class="meta-select">
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div class="meta-item">
              <span class="meta-label">Proyecto</span>
              <select v-model="draft.proyecto_id" class="meta-select">
                <option :value="null">—</option>
                <option v-for="p in proyectos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div class="meta-item">
              <span class="meta-label">Asignado a</span>
              <select v-model="draft.asignado_a" class="meta-select">
                <option :value="null">—</option>
                <option v-for="u in equipo" :key="u.id" :value="u.id">{{ u.nombre }}</option>
              </select>
            </div>
            <div class="meta-item">
              <span class="meta-label">Horas est.</span>
              <input v-model.number="draft.horas_estimadas" type="number" min="0" step="0.5" class="meta-input" />
            </div>
            <div class="meta-item">
              <span class="meta-label">Fecha inicio</span>
              <input v-model="draft.fecha_inicio_tarea" type="date" class="meta-input" />
            </div>
            <div class="meta-item">
              <span class="meta-label">Fecha límite</span>
              <input v-model="draft.fecha_limite" type="date" class="meta-input" />
            </div>
          </div>

          <!-- Description -->
          <div class="section">
            <label class="section-label">Descripción</label>
            <textarea v-model="draft.descripcion" class="desc-input" placeholder="Descripción de la tarea..." rows="3"></textarea>
          </div>

          <!-- Save -->
          <div class="save-row">
            <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
            <button class="btn-save" :disabled="saving" @click="saveDetails">
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>

          <div class="divider"></div>

          <!-- ── Subtareas ────────────────────────────────────────── -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Subtareas</span>
              <span class="section-count">{{ subtareas.filter(s => s.completada).length }}/{{ subtareas.length }}</span>
            </div>

            <div v-if="subtareas.length > 0" class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                :style="{ width: subtareas.length ? (subtareas.filter(s => s.completada).length / subtareas.length * 100) + '%' : '0%' }"
              ></div>
            </div>

            <div class="subtareas-list">
              <div v-for="s in subtareas" :key="s.id" class="subtarea-row">
                <button
                  class="subtarea-check"
                  :class="{ done: s.completada }"
                  @click="handleToggleSubtarea(s)"
                >{{ s.completada ? '✓' : '' }}</button>
                <span class="subtarea-titulo" :class="{ done: s.completada }">{{ s.titulo }}</span>
                <button class="btn-row-del" @click="handleDeleteSubtarea(s.id)">×</button>
              </div>
            </div>

            <form class="add-row" @submit.prevent="handleAddSubtarea">
              <input v-model="nuevaSubtarea" class="add-input" placeholder="Nueva subtarea..." />
              <button type="submit" class="btn-add-inline" :disabled="!nuevaSubtarea.trim()">+</button>
            </form>
          </div>

          <div class="divider"></div>

          <!-- ── Horas ───────────────────────────────────────────── -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Horas</span>
            </div>

            <div class="horas-stats">
              <div class="stat">
                <span class="stat-label">Estimadas</span>
                <span class="stat-val">{{ draft.horas_estimadas ?? 0 }}h</span>
              </div>
              <div class="stat">
                <span class="stat-label">Reales</span>
                <span class="stat-val green">{{ horasTotales }}h</span>
              </div>
              <div class="stat">
                <span class="stat-label">Desviación</span>
                <span class="stat-val" :class="desviacionClass">{{ desviacion }}</span>
              </div>
            </div>

            <form class="add-horas-form" @submit.prevent="handleAddHoras">
              <input v-model="horasForm.fecha" type="date" class="meta-input" required />
              <input v-model.number="horasForm.horas" type="number" min="0.25" step="0.25" class="meta-input" placeholder="Horas" required />
              <input v-model="horasForm.descripcion" type="text" class="add-input" placeholder="Qué se hizo..." />
              <button type="submit" class="btn-add-inline" :disabled="savingHoras">+</button>
            </form>

            <div class="horas-list">
              <div v-if="horasRegistros.length === 0" class="empty-msg">Sin registros</div>
              <div v-for="r in horasRegistros" :key="r.id" class="horas-row">
                <span class="horas-fecha">{{ formatDate(r.fecha) }}</span>
                <span class="horas-desc">{{ r.descripcion || '—' }}</span>
                <span class="horas-val">{{ r.horas }}h</span>
                <button class="btn-row-del" @click="handleDeleteHoras(r.id)">×</button>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- ── Comentarios ─────────────────────────────────────── -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Comentarios</span>
              <span class="section-count">{{ comentarios.length }}</span>
            </div>

            <div class="comentarios-list">
              <div v-if="comentarios.length === 0" class="empty-msg">Sin comentarios aún</div>
              <div v-for="c in comentarios" :key="c.id" class="comentario">
                <div class="comentario-header">
                  <span class="comentario-avatar">{{ initials(c.usuario_nombre) }}</span>
                  <span class="comentario-autor">{{ c.usuario_nombre }}</span>
                  <span class="comentario-fecha">{{ formatDateTime(c.created_at) }}</span>
                  <button
                    v-if="c.usuario_id === currentUserId"
                    class="btn-row-del"
                    @click="handleDeleteComentario(c.id)"
                  >×</button>
                </div>
                <p class="comentario-texto">{{ c.contenido }}</p>
              </div>
            </div>

            <form class="comentario-form" @submit.prevent="handleAddComentario">
              <textarea
                v-model="comentarioTexto"
                class="comentario-input"
                placeholder="Escribe un comentario..."
                rows="2"
                @keydown.ctrl.enter="handleAddComentario"
              ></textarea>
              <button type="submit" class="btn-save btn-sm" :disabled="!comentarioTexto.trim() || savingComentario">
                {{ savingComentario ? '...' : 'Comentar' }}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { COLUMNAS, updateTarea, deleteTarea } from '../services/tareas'
import type { Tarea, TareaEstado, TareaPrioridad } from '../services/tareas'
import { getSubtareasByTarea, createSubtarea, toggleSubtarea, deleteSubtarea } from '../services/subtareas'
import type { Subtarea } from '../services/subtareas'
import { getComentariosByTarea, createComentario, deleteComentario } from '../services/comentarios'
import type { ComentarioTarea } from '../services/comentarios'
import { getRegistrosByTarea, createRegistroHoras, deleteRegistroHoras } from '../services/registros_horas'
import type { RegistroHoras } from '../services/registros_horas'
import { supabase } from '../supabase'

interface UsuarioAdmin { id: string; nombre: string }
interface Proyecto { id: string; nombre: string }

const props = defineProps<{
  tarea: Tarea
  equipo: UsuarioAdmin[]
  proyectos: Proyecto[]
  currentUserId: string | null
  currentUserNombre: string
}>()

const emit = defineEmits<{
  close: []
  updated: [tarea: Tarea]
  deleted: [id: string]
}>()

// ── Draft (local copy for editing) ───────────────────────────────────────────
const draft = ref({
  titulo:             props.tarea.titulo,
  descripcion:        props.tarea.descripcion ?? '',
  estado:             props.tarea.estado as TareaEstado,
  prioridad:          props.tarea.prioridad as TareaPrioridad,
  proyecto_id:        props.tarea.proyecto_id ?? null as string | null,
  asignado_a:         props.tarea.asignado_a ?? null as string | null,
  horas_estimadas:    props.tarea.horas_estimadas ?? 0,
  fecha_inicio_tarea: props.tarea.fecha_inicio_tarea ? props.tarea.fecha_inicio_tarea.slice(0, 10) : '',
  fecha_limite:       props.tarea.fecha_limite ? props.tarea.fecha_limite.slice(0, 10) : '',
})

watch(() => props.tarea, (t) => {
  draft.value = {
    titulo:             t.titulo,
    descripcion:        t.descripcion ?? '',
    estado:             t.estado,
    prioridad:          t.prioridad,
    proyecto_id:        t.proyecto_id ?? null,
    asignado_a:         t.asignado_a ?? null,
    horas_estimadas:    t.horas_estimadas ?? 0,
    fecha_inicio_tarea: t.fecha_inicio_tarea ? t.fecha_inicio_tarea.slice(0, 10) : '',
    fecha_limite:       t.fecha_limite ? t.fecha_limite.slice(0, 10) : '',
  }
})

const estadoColor = computed(() => COLUMNAS.find(c => c.key === draft.value.estado)?.color ?? '#94a3b8')

// ── Save details ──────────────────────────────────────────────────────────────
const saving = ref(false)
const saveMsg = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveDetails() {
  saving.value = true
  try {
    const updated = await updateTarea(props.tarea.id, {
      titulo:             draft.value.titulo.trim(),
      descripcion:        draft.value.descripcion.trim() || null,
      estado:             draft.value.estado,
      prioridad:          draft.value.prioridad,
      proyecto_id:        draft.value.proyecto_id || null,
      asignado_a:         draft.value.asignado_a || null,
      horas_estimadas:    draft.value.horas_estimadas || 0,
      fecha_inicio_tarea: draft.value.fecha_inicio_tarea || null,
      fecha_limite:       draft.value.fecha_limite || null,
    })
    emit('updated', updated)
    saveMsg.value = '✓ Guardado'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saveMsg.value = '' }, 2500)
  } catch {
    saveMsg.value = 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm(`¿Eliminar la tarea "${props.tarea.titulo}"?`)) return
  await deleteTarea(props.tarea.id)
  emit('deleted', props.tarea.id)
}

// ── Subtareas ─────────────────────────────────────────────────────────────────
const subtareas = ref<Subtarea[]>([])
const nuevaSubtarea = ref('')

async function loadSubtareas() {
  subtareas.value = await getSubtareasByTarea(props.tarea.id)
}

async function handleAddSubtarea() {
  if (!nuevaSubtarea.value.trim()) return
  const s = await createSubtarea(props.tarea.id, nuevaSubtarea.value.trim())
  subtareas.value.push(s)
  nuevaSubtarea.value = ''
}

async function handleToggleSubtarea(s: Subtarea) {
  await toggleSubtarea(s.id, !s.completada)
  s.completada = !s.completada
}

async function handleDeleteSubtarea(id: string) {
  await deleteSubtarea(id)
  subtareas.value = subtareas.value.filter(s => s.id !== id)
}

// ── Horas ─────────────────────────────────────────────────────────────────────
const horasRegistros = ref<RegistroHoras[]>([])
const savingHoras = ref(false)
const horasForm = ref({ fecha: new Date().toISOString().split('T')[0] ?? '', horas: 0, descripcion: '' })

const horasTotales = computed(() => horasRegistros.value.reduce((s, r) => s + Number(r.horas), 0))

const desviacion = computed(() => {
  const est = Number(draft.value.horas_estimadas ?? 0)
  const real = horasTotales.value
  if (!est && !real) return '—'
  const diff = real - est
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}h`
})

const desviacionClass = computed(() => {
  const est = Number(draft.value.horas_estimadas ?? 0)
  const real = horasTotales.value
  if (!est && !real) return ''
  return real > est ? 'red' : 'green'
})

async function loadHoras() {
  horasRegistros.value = await getRegistrosByTarea(props.tarea.id)
}

async function handleAddHoras() {
  if (!horasForm.value.horas) return
  savingHoras.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await createRegistroHoras({
      tarea_id: props.tarea.id,
      proyecto_id: props.tarea.proyecto_id ?? null,
      usuario_id: user!.id,
      fecha: horasForm.value.fecha,
      horas: horasForm.value.horas,
      descripcion: horasForm.value.descripcion,
    })
    horasRegistros.value = await getRegistrosByTarea(props.tarea.id)
    horasForm.value = { fecha: new Date().toISOString().split('T')[0] ?? '', horas: 0, descripcion: '' }
  } finally {
    savingHoras.value = false
  }
}

async function handleDeleteHoras(id: string) {
  await deleteRegistroHoras(id)
  horasRegistros.value = horasRegistros.value.filter(r => r.id !== id)
}

// ── Comentarios ───────────────────────────────────────────────────────────────
const comentarios = ref<ComentarioTarea[]>([])
const comentarioTexto = ref('')
const savingComentario = ref(false)

async function loadComentarios() {
  comentarios.value = await getComentariosByTarea(props.tarea.id)
}

async function handleAddComentario() {
  if (!comentarioTexto.value.trim() || !props.currentUserId) return
  savingComentario.value = true
  try {
    const c = await createComentario({
      tarea_id:       props.tarea.id,
      usuario_id:     props.currentUserId,
      usuario_nombre: props.currentUserNombre,
      contenido:      comentarioTexto.value.trim(),
    })
    comentarios.value.push(c)
    comentarioTexto.value = ''
  } finally {
    savingComentario.value = false
  }
}

async function handleDeleteComentario(id: string) {
  await deleteComentario(id)
  comentarios.value = comentarios.value.filter(c => c.id !== id)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(nombre: string): string {
  return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Load on mount ─────────────────────────────────────────────────────────────
onMounted(() => Promise.all([loadSubtareas(), loadHoras(), loadComentarios()]))
</script>

<style scoped>
/* ── Backdrop + Panel ──────────────────────────────────────────────────────── */
.panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.detail-panel {
  width: 100%;
  max-width: 560px;
  height: 100%;
  background: var(--color-bg-card);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.2s ease;
  overflow: hidden;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-back {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 1rem;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-back:hover { color: var(--color-text-light); }

.estado-pill {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-delete-panel {
  background: none;
  border: 1px solid transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.btn-delete-panel:hover {
  color: #f87171;
  border-color: #f8717155;
  background: #f8717111;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Title ─────────────────────────────────────────────────────────────────── */
.title-input {
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text-light);
  font-size: 1.3rem;
  font-weight: 700;
  font-family: inherit;
  padding: 4px 0 8px;
  outline: none;
  transition: border-color 0.15s;
}

.title-input:focus { border-color: var(--color-primary); }

/* ── Meta grid ─────────────────────────────────────────────────────────────── */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.meta-select,
.meta-input {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.82rem;
  padding: 6px 8px;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.meta-select:focus,
.meta-input:focus { border-color: var(--color-primary); }

.meta-select {
  appearance: none;
  cursor: pointer;
}

/* ── Description ───────────────────────────────────────────────────────────── */
.desc-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 10px 12px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.15s;
}

.desc-input:focus { border-color: var(--color-primary); }
.desc-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }

/* ── Save row ──────────────────────────────────────────────────────────────── */
.save-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.save-msg {
  font-size: 0.82rem;
  color: #34d399;
}

.btn-save {
  background: var(--color-primary);
  color: #000;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-save:hover:not(:disabled) { opacity: 0.88; }
.btn-save.btn-sm { padding: 6px 14px; }

/* ── Divider ───────────────────────────────────────────────────────────────── */
.divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

/* ── Section ───────────────────────────────────────────────────────────────── */
.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-light);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--color-bg-lighter);
  padding: 1px 8px;
  border-radius: 20px;
}

/* ── Progress bar ──────────────────────────────────────────────────────────── */
.progress-bar-bg {
  height: 4px;
  background: var(--color-bg-lighter);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s;
}

/* ── Subtareas ─────────────────────────────────────────────────────────────── */
.subtareas-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtarea-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
}

.subtarea-check {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #000;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}

.subtarea-check.done {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.subtarea-titulo {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-light);
}

.subtarea-titulo.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

/* ── Add row ───────────────────────────────────────────────────────────────── */
.add-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.add-input {
  flex: 1;
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 7px 10px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.add-input:focus { border-color: var(--color-primary); }
.add-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }

.btn-add-inline {
  background: var(--color-primary);
  border: none;
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.btn-add-inline:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-row-del {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s;
  flex-shrink: 0;
}

.btn-row-del:hover { color: #f87171; }

/* ── Horas ─────────────────────────────────────────────────────────────────── */
.horas-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.stat-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-light);
}

.stat-val.green { color: #34d399; }
.stat-val.red   { color: #f87171; }

.add-horas-form {
  display: grid;
  grid-template-columns: 130px 80px 1fr 30px;
  gap: 6px;
  align-items: center;
}

.horas-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.horas-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border)44;
  font-size: 0.82rem;
}

.horas-fecha {
  color: var(--color-text-muted);
  white-space: nowrap;
  width: 60px;
  flex-shrink: 0;
}

.horas-desc {
  flex: 1;
  color: var(--color-text-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.horas-val {
  font-weight: 600;
  color: #34d399;
  flex-shrink: 0;
}

/* ── Comentarios ───────────────────────────────────────────────────────────── */
.comentarios-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comentario {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.comentario-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comentario-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #000;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comentario-autor {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-light);
}

.comentario-fecha {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex: 1;
}

.comentario-texto {
  font-size: 0.875rem;
  color: var(--color-text-light);
  line-height: 1.5;
  margin: 0 0 0 36px;
  white-space: pre-wrap;
  word-break: break-word;
}

.comentario-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.comentario-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 10px 12px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s;
}

.comentario-input:focus { border-color: var(--color-primary); }
.comentario-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }

/* ── Empty / misc ──────────────────────────────────────────────────────────── */
.empty-msg {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  opacity: 0.6;
  padding: 4px 0;
}

@media (max-width: 640px) {
  .detail-panel { max-width: 100%; }
  .add-horas-form { grid-template-columns: 1fr 1fr; }
}
</style>
