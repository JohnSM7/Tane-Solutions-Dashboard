<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import { supabase } from '../supabase';
import { ESTADO_COLORS } from '../services/operations';
import { updateTarea, deleteTarea, deleteTareasFromDate, COLUMNAS, createTareaRecurrente, FRECUENCIA_LABELS } from '../services/tareas';
import type { Tarea, TareaEstado, TareaPrioridad, FrecuenciaRecurrencia } from '../services/tareas';
import TaskDetailPanel from '../components/TaskDetailPanel.vue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TareaRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TareaEstado;
  prioridad: TareaPrioridad;
  proyecto_id: string | null;
  lead_id: string | null;
  asignado_a: string | null;
  horas_estimadas: number;
  fecha_inicio_tarea: string | null;
  fecha_limite: string | null;
  recurrencia_id: string | null;
  es_recurrente: boolean;
  frecuencia_recurrencia: FrecuenciaRecurrencia | null;
  created_at: string;
}

interface ProyectoRow {
  id: string;
  nombre: string;
  estado: string;
  fecha_entrega_estimada: string | null;
}

interface CalEvent {
  id: string;
  type: 'tarea' | 'proyecto';
  title: string;
  color: string;        // project color (main bar color)
  priorityColor: string; // priority dot color
  estado: string;
  prioridad?: string;
  date: string;
  role: 'single' | 'start' | 'mid' | 'end';
  tareaRef?: TareaRow;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORIDAD_COLOR: Record<string, string> = {
  Alta: '#ff4444', Media: '#ffa500', Baja: '#94a3b8',
};

const PROJECT_COLORS = [
  '#60a5fa', '#f472b6', '#34d399', '#fb923c',
  '#a78bfa', '#22d3ee', '#fbbf24', '#f87171',
  '#4ade80', '#818cf8', '#e879f9', '#2dd4bf',
];

function hashProjectColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  return PROJECT_COLORS[h % PROJECT_COLORS.length]!;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const today = new Date();
today.setHours(0, 0, 0, 0);

const currentYear  = ref(today.getFullYear());
const currentMonth = ref(today.getMonth());

const tareas    = ref<TareaRow[]>([]);
const proyectos = ref<ProyectoRow[]>([]);
const loading   = ref(true);

const selectedDay = ref<string | null>(null);

// team + projects for the create form
interface UsuarioAdmin { id: string; nombre: string }
const equipo           = ref<UsuarioAdmin[]>([]);
const proyList         = ref<{ id: string; nombre: string }[]>([]);
const currentUserId    = ref<string | null>(null);
const currentUserNombre = ref('');

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value -= 1; }
  else { currentMonth.value -= 1; }
  selectedDay.value = null;
}

function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value += 1; }
  else { currentMonth.value += 1; }
  selectedDay.value = null;
}

const monthLabel = computed(() => `${MESES_ES[currentMonth.value]} ${currentYear.value}`);

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

interface DayCell { date: Date; key: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean; }

const gridDays = computed<DayCell[]>(() => {
  const year = currentYear.value, month = currentMonth.value;
  const firstRaw   = new Date(year, month, 1).getDay();
  const startOff   = firstRaw === 0 ? 6 : firstRaw - 1;
  const daysInMon  = new Date(year, month + 1, 0).getDate();
  const total      = Math.ceil((startOff + daysInMon) / 7) * 7;
  const days: DayCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month, 1 - startOff + i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d, key: toKey(d), dayNum: d.getDate(), isCurrentMonth: d.getMonth() === month, isToday: d.getTime() === today.getTime() });
  }
  return days;
});

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toKey(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const events = computed<CalEvent[]>(() => {
  const result: CalEvent[] = [];

  for (const t of tareas.value) {
    const color         = t.proyecto_id ? hashProjectColor(t.proyecto_id) : '#94a3b8';
    const priorityColor = PRIORIDAD_COLOR[t.prioridad] ?? '#94a3b8';
    const inicio        = t.fecha_inicio_tarea?.slice(0, 10) ?? null;
    const fin           = t.fecha_limite?.slice(0, 10) ?? null;

    if (inicio && fin && inicio !== fin) {
      const days = daysBetween(inicio, fin);
      for (let i = 0; i <= days; i++) {
        const d = addDays(inicio, i);
        result.push({
          id: t.id + '_' + d, type: 'tarea', title: t.titulo,
          color, priorityColor, estado: t.estado,
          prioridad: t.prioridad, date: d,
          role: i === 0 ? 'start' : i === days ? 'end' : 'mid',
          tareaRef: t,
        });
      }
    } else if (fin) {
      result.push({ id: t.id, type: 'tarea', title: t.titulo, color, priorityColor, estado: t.estado, prioridad: t.prioridad, date: fin, role: 'single', tareaRef: t });
    } else if (inicio) {
      result.push({ id: t.id, type: 'tarea', title: t.titulo, color, priorityColor, estado: t.estado, prioridad: t.prioridad, date: inicio, role: 'single', tareaRef: t });
    }
  }

  for (const p of proyectos.value) {
    if (!p.fecha_entrega_estimada) continue;
    const color = ESTADO_COLORS[p.estado] ?? '#e3ff04';
    result.push({ id: p.id, type: 'proyecto', title: p.nombre, color, priorityColor: color, estado: p.estado, date: p.fecha_entrega_estimada.slice(0, 10), role: 'single' });
  }

  return result;
});

const eventMap = computed<Record<string, CalEvent[]>>(() => {
  const map: Record<string, CalEvent[]> = {};
  for (const ev of events.value) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date]!.push(ev);
  }
  return map;
});

// (eventMap still used by selectedDayEvents below)

// ---------------------------------------------------------------------------
// Week-row bar layout (Google Calendar style)
// ---------------------------------------------------------------------------

const MAX_LANES = 3;

interface EventBar {
  id: string;
  event: CalEvent;
  startCol: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

const gridWeeks = computed<DayCell[][]>(() => {
  const d = gridDays.value;
  const w: DayCell[][] = [];
  for (let i = 0; i < d.length; i += 7) w.push(d.slice(i, i + 7));
  return w;
});

function computeBarsForWeek(week: DayCell[]): { bars: EventBar[]; overflowByCol: number[]; maxLane: number } {
  const keys   = week.map(d => d.key);
  const wStart = keys[0]!;
  const wEnd   = keys[6]!;

  // Deduplicate events by base id
  const seen = new Set<string>();
  const uniq: CalEvent[] = [];
  for (const k of keys) {
    for (const ev of eventMap.value[k] ?? []) {
      const bid = ev.tareaRef?.id ?? ev.id;
      if (!seen.has(bid)) { seen.add(bid); uniq.push(ev); }
    }
  }

  // Build drafts
  type Draft = { bid: string; ev: CalEvent; sc: number; span: number; cl: boolean; cr: boolean };
  const drafts: Draft[] = [];
  for (const ev of uniq) {
    let s: string, e: string;
    if (ev.tareaRef) {
      s = ev.tareaRef.fecha_inicio_tarea?.slice(0, 10) ?? ev.tareaRef.fecha_limite?.slice(0, 10) ?? ev.date;
      e = ev.tareaRef.fecha_limite?.slice(0, 10) ?? s;
    } else { s = ev.date; e = ev.date; }

    const cl = s < wStart, cr = e > wEnd;
    const es = cl ? wStart : s;
    const ee = cr ? wEnd   : e;
    const sc = keys.indexOf(es), ec = keys.indexOf(ee);
    if (sc < 0 && ec < 0) continue;
    const c0 = sc >= 0 ? sc : 0, c1 = ec >= 0 ? ec : 6;
    drafts.push({ bid: ev.tareaRef?.id ?? ev.id, ev, sc: c0, span: Math.max(1, c1 - c0 + 1), cl, cr });
  }

  // Sort: longest first, then earliest start
  drafts.sort((a, b) => b.span - a.span || a.sc - b.sc);

  // Interval lane assignment
  const laneEnd: number[] = [];
  const allBars: EventBar[] = drafts.map(d => {
    let lane = 0;
    while (laneEnd[lane] !== undefined && laneEnd[lane]! >= d.sc) lane++;
    laneEnd[lane] = d.sc + d.span - 1;
    return { id: d.bid + '_' + wStart, event: d.ev, startCol: d.sc, span: d.span, lane, continuesLeft: d.cl, continuesRight: d.cr };
  });

  const visible = allBars.filter(b => b.lane < MAX_LANES);
  const overflowByCol = keys.map((_, col) => {
    const total = allBars.filter(b => b.startCol <= col && b.startCol + b.span - 1 >= col).length;
    const shown = visible.filter(b => b.startCol <= col && b.startCol + b.span - 1 >= col).length;
    return total - shown;
  });
  const maxLane = visible.length > 0 ? Math.max(...visible.map(b => b.lane)) : -1;
  return { bars: visible, overflowByCol, maxLane };
}

const _weekBarsCache = computed(() => gridWeeks.value.map(w => computeBarsForWeek(w)));

const EMPTY_WEEK_DATA = { bars: [] as EventBar[], overflowByCol: Array(7).fill(0) as number[], maxLane: -1 };
function weekBarsMap(wi: number): { bars: EventBar[]; overflowByCol: number[]; maxLane: number } {
  return _weekBarsCache.value[wi] ?? EMPTY_WEEK_DATA;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchData() {
  loading.value = true;
  try {
    const [tareasRes, proyRes, equipoRes, proyListRes, userRes] = await Promise.all([
      supabase.from('tareas').select('id, titulo, descripcion, estado, prioridad, proyecto_id, lead_id, asignado_a, horas_estimadas, fecha_inicio_tarea, fecha_limite, recurrencia_id, es_recurrente, frecuencia_recurrencia, created_at'),
      supabase.from('proyectos').select('id, nombre, estado, fecha_entrega_estimada').not('fecha_entrega_estimada', 'is', null).neq('estado', 'Completado'),
      supabase.from('usuarios').select('id, nombre').eq('rol', 'ADMIN').order('nombre'),
      supabase.from('proyectos').select('id, nombre').neq('estado', 'Completado'),
      supabase.auth.getUser(),
    ]);
    tareas.value    = (tareasRes.data ?? []) as TareaRow[];
    proyectos.value = (proyRes.data ?? []) as ProyectoRow[];
    equipo.value    = (equipoRes.data ?? []) as UsuarioAdmin[];
    proyList.value  = (proyListRes.data ?? []) as { id: string; nombre: string }[];
    currentUserId.value = userRes.data.user?.id ?? null;
    if (currentUserId.value) {
      const u = (equipoRes.data ?? []).find((u: any) => u.id === currentUserId.value) as any;
      currentUserNombre.value = u?.nombre ?? 'Usuario';
    }
  } catch (e) {
    console.error('CalendarioView fetch error', e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

// ---------------------------------------------------------------------------
// Day selection
// ---------------------------------------------------------------------------

function selectDay(cell: DayCell) {
  selectedDay.value = selectedDay.value === cell.key ? null : cell.key;
  createForm.value.fecha_inicio_tarea = cell.key;
  createForm.value.fecha_limite = cell.key;
}

const selectedDayEvents = computed<CalEvent[]>(() => {
  if (!selectedDay.value) return [];
  // Deduplicate: only show each tarea once (by original id, not ranged id)
  const seen = new Set<string>();
  return (eventMap.value[selectedDay.value] ?? []).filter(ev => {
    const key = ev.tareaRef?.id ?? ev.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const selectedDayLabel = computed<string>(() => {
  if (!selectedDay.value) return '';
  const d = new Date(selectedDay.value + 'T00:00:00');
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
});

// ---------------------------------------------------------------------------
// Create task form
// ---------------------------------------------------------------------------

const showCreate = ref(false);

interface CreateForm {
  titulo: string;
  estado: TareaEstado;
  prioridad: TareaPrioridad;
  proyecto_id: string | null;
  asignado_a: string | null;
  fecha_inicio_tarea: string;
  fecha_limite: string;
  es_recurrente: boolean;
  frecuencia_recurrencia: FrecuenciaRecurrencia;
}

const createForm = ref<CreateForm>({
  titulo: '', estado: 'backlog', prioridad: 'Media',
  proyecto_id: null, asignado_a: null,
  fecha_inicio_tarea: toKey(today), fecha_limite: toKey(today),
  es_recurrente: false, frecuencia_recurrencia: 'semanal',
});

const savingCreate = ref(false);

async function submitCreate() {
  if (!createForm.value.titulo.trim()) return;
  savingCreate.value = true;
  try {
    const basePayload = {
      titulo:             createForm.value.titulo.trim(),
      estado:             createForm.value.estado,
      prioridad:          createForm.value.prioridad,
      proyecto_id:        createForm.value.proyecto_id || null,
      asignado_a:         createForm.value.asignado_a || null,
      fecha_inicio_tarea: createForm.value.fecha_inicio_tarea || null,
      fecha_limite:       createForm.value.fecha_limite || null,
    };

    if (createForm.value.es_recurrente) {
      if (!createForm.value.fecha_limite) return;
      await createTareaRecurrente(basePayload, createForm.value.frecuencia_recurrencia);
      await fetchData();
    } else {
      const { data, error } = await supabase.from('tareas').insert(basePayload).select('id, titulo, estado, prioridad, fecha_inicio_tarea, fecha_limite').single();
      if (error) throw error;
      tareas.value.push(data as TareaRow);
    }

    showCreate.value = false;
    createForm.value = { titulo: '', estado: 'backlog', prioridad: 'Media', proyecto_id: null, asignado_a: null, fecha_inicio_tarea: toKey(today), fecha_limite: toKey(today), es_recurrente: false, frecuencia_recurrencia: 'semanal' };
  } catch (e) {
    console.error('Error creating task', e);
  } finally {
    savingCreate.value = false;
  }
}

// ---------------------------------------------------------------------------
// Status change from calendar
// ---------------------------------------------------------------------------

async function changeEstado(ev: CalEvent, newEstado: TareaEstado) {
  if (!ev.tareaRef) return;
  try {
    await updateTarea(ev.tareaRef.id, { estado: newEstado });
    const t = tareas.value.find(t => t.id === ev.tareaRef!.id);
    if (t) t.estado = newEstado;
  } catch (e) {
    console.error('Error updating task status', e);
  }
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

const panelTarea = ref<Tarea | null>(null);

function openPanel(tareaRow: TareaRow) {
  panelTarea.value = tareaRow as unknown as Tarea;
}

function onPanelUpdated(updated: Tarea) {
  const idx = tareas.value.findIndex(t => t.id === updated.id);
  if (idx !== -1) tareas.value[idx] = { ...tareas.value[idx], ...updated } as TareaRow;
  panelTarea.value = tareas.value[idx] as unknown as Tarea ?? updated;
}

function onPanelDeleted(id: string) {
  tareas.value = tareas.value.filter(t => t.id !== id);
  panelTarea.value = null;
}

// ---------------------------------------------------------------------------
// Delete from calendar
// ---------------------------------------------------------------------------

const deleteDialogTarea = ref<TareaRow | null>(null);

function requestDelete(tareaRow: TareaRow) {
  if (tareaRow.es_recurrente && tareaRow.recurrencia_id) {
    deleteDialogTarea.value = tareaRow;
    return;
  }
  if (!confirm(`¿Eliminar "${tareaRow.titulo}"?`)) return;
  doDeleteSingle(tareaRow.id);
}

async function doDeleteSingle(id: string) {
  try {
    await deleteTarea(id);
    tareas.value = tareas.value.filter(t => t.id !== id);
    if (panelTarea.value?.id === id) panelTarea.value = null;
  } catch (e) { console.error(e); }
}

async function deleteOnlyThis() {
  const t = deleteDialogTarea.value;
  if (!t) return;
  deleteDialogTarea.value = null;
  await doDeleteSingle(t.id);
}

async function deleteThisAndFuture() {
  const t = deleteDialogTarea.value;
  if (!t || !t.recurrencia_id || !t.fecha_limite) return;
  deleteDialogTarea.value = null;
  try {
    await deleteTareasFromDate(t.recurrencia_id, t.fecha_limite);
    await fetchData();
    if (panelTarea.value?.recurrencia_id === t.recurrencia_id) panelTarea.value = null;
  } catch (e) { console.error(e); }
}
</script>

<template>
  <div class="calendario-view">
    <DashboardCard title="Calendario">
      <template #actions>
        <div class="header-actions">
          <div class="legend">
            <span class="legend-item"><span class="legend-dot" style="background:#ffa500"></span>Tarea</span>
            <span class="legend-item"><span class="legend-dot" style="background:#e3ff04"></span>Proyecto</span>
          </div>
          <button class="btn-primary" @click="showCreate = true">+ Nueva tarea</button>
        </div>
      </template>

      <!-- Navigation -->
      <div class="nav-row">
        <button class="nav-btn" @click="prevMonth">‹</button>
        <h2 class="month-label">{{ monthLabel }}</h2>
        <button class="nav-btn" @click="nextMonth">›</button>
      </div>

      <div v-if="loading" class="loading-msg">Cargando eventos…</div>

      <template v-else>
        <!-- Calendar grid -->
        <div class="cal-grid">
          <!-- Day-of-week headers -->
          <div class="dow-row">
            <div v-for="dia in DIAS_SEMANA" :key="dia" class="dow-header">{{ dia }}</div>
          </div>

          <!-- Week rows -->
          <div v-for="(week, wi) in gridWeeks" :key="wi" class="week-row">
            <!-- Cell backgrounds + day numbers -->
            <div class="week-cells">
              <div
                v-for="(cell, ci) in week"
                :key="cell.key"
                class="day-cell"
                :class="{
                  'outside-month': !cell.isCurrentMonth,
                  'is-today':      cell.isToday,
                  'is-selected':   selectedDay === cell.key,
                }"
                @click="selectDay(cell)"
              >
                <span class="day-num" :class="{ 'today-circle': cell.isToday }">{{ cell.dayNum }}</span>
                <span v-if="weekBarsMap(wi).overflowByCol[ci]" class="overflow-badge">
                  +{{ weekBarsMap(wi).overflowByCol[ci] }}
                </span>
              </div>
            </div>

            <!-- Absolutely positioned event bars -->
            <div
              class="week-events"
              :style="{ height: (weekBarsMap(wi).maxLane + 1) * 22 + 8 + 'px' }"
            >
              <div
                v-for="bar in weekBarsMap(wi).bars"
                :key="bar.id"
                class="event-bar"
                :class="{
                  'cl': bar.continuesLeft,
                  'cr': bar.continuesRight,
                  'is-proyecto': bar.event.type === 'proyecto',
                }"
                :style="{
                  left:  `calc(${bar.startCol} / 7 * 100% + 3px)`,
                  width: `calc(${bar.span}      / 7 * 100% - 6px)`,
                  top:   `${bar.lane * 22 + 2}px`,
                  '--ev-color': bar.event.color,
                  '--pr-color': bar.event.priorityColor,
                }"
                :title="bar.event.title"
                @click.stop="bar.event.tareaRef ? openPanel(bar.event.tareaRef) : null"
              >
                <span v-if="!bar.continuesLeft" class="ev-dot"></span>
                <span class="ev-text">{{ bar.event.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected day panel -->
        <div v-if="selectedDay" class="day-panel">
          <div class="day-panel-header">
            <span class="day-panel-title">{{ selectedDayLabel }}</span>
            <div class="day-panel-actions">
              <button class="btn-add-day" @click="showCreate = true; createForm.fecha_inicio_tarea = selectedDay!; createForm.fecha_limite = selectedDay!">
                + Tarea
              </button>
              <button class="close-btn" @click="selectedDay = null">✕</button>
            </div>
          </div>

          <div v-if="selectedDayEvents.length === 0" class="no-events">
            Sin eventos. <button class="btn-link" @click="showCreate = true; createForm.fecha_inicio_tarea = selectedDay!; createForm.fecha_limite = selectedDay!">Crear tarea</button>
          </div>

          <div v-else class="event-list">
            <div
              v-for="ev in selectedDayEvents"
              :key="ev.tareaRef?.id ?? ev.id"
              class="event-item"
              :style="{ borderLeftColor: ev.color }"
            >
              <div class="event-type-dot" :style="{ background: ev.color }"></div>
              <div class="event-details">
                <div class="event-title-row">
                  <span class="event-title">{{ ev.title }}</span>
                  <div v-if="ev.tareaRef" class="event-actions">
                    <button class="ev-btn-edit" @click.stop="openPanel(ev.tareaRef!)">Editar</button>
                    <button class="ev-btn-del" @click.stop="requestDelete(ev.tareaRef!)">×</button>
                  </div>
                </div>
                <div class="event-meta">
                  <span v-if="ev.type === 'tarea'" class="ev-type">Tarea</span>
                  <span v-else class="ev-type proyecto">Proyecto</span>
                  <span v-if="ev.prioridad" class="ev-badge" :style="{ color: ev.color, background: ev.color + '22' }">{{ ev.prioridad }}</span>

                  <!-- Status selector for tareas -->
                  <select
                    v-if="ev.tareaRef"
                    class="estado-select"
                    :value="ev.tareaRef.estado"
                    @change="changeEstado(ev, ($event.target as HTMLSelectElement).value as TareaEstado)"
                    @click.stop
                  >
                    <option v-for="col in COLUMNAS" :key="col.key" :value="col.key">{{ col.label }}</option>
                  </select>
                  <span v-else class="ev-badge muted">{{ ev.estado }}</span>

                  <span v-if="ev.tareaRef?.es_recurrente && ev.tareaRef?.frecuencia_recurrencia" class="ev-badge recurrent">
                    ↻ {{ FRECUENCIA_LABELS[ev.tareaRef.frecuencia_recurrencia] }}
                  </span>
                </div>

                <!-- Date range info -->
                <div v-if="ev.tareaRef?.fecha_inicio_tarea && ev.tareaRef?.fecha_limite" class="ev-range">
                  {{ ev.tareaRef.fecha_inicio_tarea.slice(0,10) }} → {{ ev.tareaRef.fecha_limite.slice(0,10) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DashboardCard>

    <!-- Task detail panel -->
    <Teleport to="body">
      <TaskDetailPanel
        v-if="panelTarea"
        :tarea="panelTarea"
        :equipo="equipo"
        :proyectos="proyList"
        :current-user-id="currentUserId"
        :current-user-nombre="currentUserNombre"
        @close="panelTarea = null"
        @updated="onPanelUpdated"
        @deleted="onPanelDeleted"
      />

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
    </Teleport>

    <!-- Create task modal -->
    <Teleport to="body">
      <div v-if="showCreate" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Nueva Tarea</h2>
            <button class="modal-close" @click="showCreate = false">×</button>
          </div>
          <form class="modal-form" @submit.prevent="submitCreate">
            <div class="form-group">
              <label class="form-label">Título <span class="required">*</span></label>
              <input v-model="createForm.titulo" class="form-input" type="text" placeholder="Nombre de la tarea" required autofocus />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Estado</label>
                <select v-model="createForm.estado" class="form-input form-select">
                  <option v-for="col in COLUMNAS" :key="col.key" :value="col.key">{{ col.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Prioridad</label>
                <select v-model="createForm.prioridad" class="form-input form-select">
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha inicio</label>
                <input v-model="createForm.fecha_inicio_tarea" class="form-input" type="date" />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha límite</label>
                <input v-model="createForm.fecha_limite" class="form-input" type="date" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Proyecto</label>
              <select v-model="createForm.proyecto_id" class="form-input form-select">
                <option :value="null">Sin proyecto</option>
                <option v-for="p in proyList" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Asignado a</label>
              <select v-model="createForm.asignado_a" class="form-input form-select">
                <option :value="null">Sin asignar</option>
                <option v-for="u in equipo" :key="u.id" :value="u.id">{{ u.nombre }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Recurrencia</label>
              <div class="recurrencia-row">
                <button
                  type="button"
                  class="toggle-recurrencia"
                  :class="{ active: createForm.es_recurrente }"
                  @click="createForm.es_recurrente = !createForm.es_recurrente"
                >↻ {{ createForm.es_recurrente ? 'Recurrente' : 'Sin recurrencia' }}</button>
                <select v-if="createForm.es_recurrente" v-model="createForm.frecuencia_recurrencia" class="form-input form-select recurrencia-freq">
                  <option v-for="(label, key) in FRECUENCIA_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>
              <p v-if="createForm.es_recurrente && !createForm.fecha_limite" class="recurrencia-hint">Necesita fecha límite para generar instancias</p>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" @click="showCreate = false">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="savingCreate">
                {{ savingCreate ? 'Creando...' : 'Crear tarea' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────────── */
.calendario-view { padding: 1.5rem; }

/* ── Header actions ────────────────────────────────────────────────────────── */
.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.legend {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

/* ── Navigation ────────────────────────────────────────────────────────────── */
.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.month-label {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-light);
  margin: 0;
  flex: 1;
  text-align: center;
}

.nav-btn {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-light);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
}

.nav-btn:hover { border-color: var(--color-primary); background: var(--color-primary)11; }

/* ── Grid ──────────────────────────────────────────────────────────────────── */
.cal-grid {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.dow-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background: var(--color-bg-lighter);
  border-bottom: 1px solid var(--color-border);
}

.dow-header {
  text-align: center;
  padding: 8px 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-right: 1px solid var(--color-border);
}
.dow-header:last-child { border-right: none; }

/* ── Week rows ─────────────────────────────────────────────────────────────── */
.week-row {
  border-bottom: 1px solid var(--color-border);
}
.week-row:last-child { border-bottom: none; }

.week-cells {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.day-cell {
  border-right: 1px solid var(--color-border);
  min-height: 38px;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  transition: background 0.12s;
}
.day-cell:last-child { border-right: none; }
.day-cell:hover { background: var(--color-primary)07; }
.day-cell.outside-month { opacity: 0.28; }
.day-cell.is-today { background: var(--color-primary)09; }
.day-cell.is-selected { box-shadow: inset 0 0 0 2px var(--color-primary); background: var(--color-primary)0d; }

.day-num {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  padding: 2px 5px;
  border-radius: 50%;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.today-circle { background: var(--color-primary); color: #000; font-weight: 700; }

.overflow-badge {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  align-self: flex-start;
}

/* ── Event bars (absolutely positioned inside .week-events) ────────────────── */
.week-events {
  position: relative;
  min-height: 26px;
}

.event-bar {
  position: absolute;
  height: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  font-size: 0.68rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;
  border-left: 3px solid var(--ev-color);
  background: color-mix(in srgb, var(--ev-color) 20%, #111827);
  color: var(--ev-color);
  transition: filter 0.1s;
}
.event-bar:hover { filter: brightness(1.15); }

/* Continuation adjustments */
.event-bar.cl { border-left: none; border-radius: 0 4px 4px 0; padding-left: 4px; }
.event-bar.cr { border-radius: 4px 0 0 4px; padding-right: 4px; }
.event-bar.cl.cr { border-radius: 0; }

/* Projects: dashed border */
.event-bar.is-proyecto { border-left-style: dashed; }

.ev-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--pr-color);
  flex-shrink: 0;
}

.ev-text {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

/* ── Day panel ─────────────────────────────────────────────────────────────── */
.day-panel {
  margin-top: 1rem;
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.day-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.day-panel-title { font-size: 0.9rem; font-weight: 600; color: var(--color-text-light); }

.day-panel-actions { display: flex; align-items: center; gap: 8px; }

.btn-add-day {
  background: var(--color-primary);
  border: none;
  color: #000;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-add-day:hover { opacity: 0.85; }

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--color-text-light); }

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  text-decoration: underline;
}

.no-events { color: var(--color-text-muted); font-size: 0.85rem; padding: 1.25rem 1rem; }

/* ── Event list ────────────────────────────────────────────────────────────── */
.event-list { display: flex; flex-direction: column; }

.event-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border)55;
  border-left: 4px solid transparent;
  transition: background 0.1s;
}
.event-item:last-child { border-bottom: none; }
.event-item:hover { background: rgba(255,255,255,0.03); }

.event-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }

.event-details { flex: 1; min-width: 0; }

.event-title { font-size: 0.875rem; font-weight: 500; color: var(--color-text-light); line-height: 1.35; word-break: break-word; }

.event-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; align-items: center; }

.ev-type {
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 20px;
  font-weight: 600;
  background: #3b82f622;
  color: #60a5fa;
}
.ev-type.proyecto { background: var(--color-primary)22; color: var(--color-primary); }

.ev-badge { font-size: 0.7rem; padding: 2px 7px; border-radius: 20px; font-weight: 500; }
.ev-badge.muted { background: var(--color-bg-lighter); color: var(--color-text-muted); }

.estado-select {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.75rem;
  padding: 3px 24px 3px 8px;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 7px center;
  transition: border-color 0.15s;
}
.estado-select:focus { outline: none; border-color: var(--color-primary); }

.ev-range { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px; }

.event-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.event-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.event-item:hover .event-actions { opacity: 1; }

.ev-btn-edit {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}
.ev-btn-edit:hover { color: var(--color-primary); border-color: var(--color-primary); }

.ev-btn-del {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  padding: 0 4px;
  cursor: pointer;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s;
}
.ev-btn-del:hover { color: #f87171; }

.ev-badge.recurrent {
  background: var(--color-primary)18;
  color: var(--color-primary);
  border: 1px solid var(--color-primary)44;
}

/* ── Delete dialog ─────────────────────────────────────────────────────────── */
.modal-sm { max-width: 400px; }

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

/* ── Loading ───────────────────────────────────────────────────────────────── */
.loading-msg { text-align: center; color: var(--color-text-muted); padding: 3rem 0; }

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.btn-primary {
  background: var(--color-primary);
  color: #000;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary:hover:not(:disabled) { opacity: 0.88; }

.btn-secondary {
  background: var(--color-bg-lighter);
  color: var(--color-text-light);
  border: 1px solid var(--color-border);
  padding: 8px 18px;
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
  background: rgba(0,0,0,0.65);
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
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title { font-size: 1.05rem; font-weight: 700; margin: 0; }

.modal-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}
.modal-close:hover { color: var(--color-text-light); }

.modal-form { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 14px; }

.form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.form-label { font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

.required { color: #f87171; }

.form-input {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-light);
  font-size: 0.875rem;
  padding: 8px 10px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
  font-family: inherit;
}
.form-input:focus { outline: none; border-color: var(--color-primary); }
.form-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }

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
  padding-top: 14px;
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

.recurrencia-freq { flex: 1; min-width: 120px; }

.recurrencia-hint {
  font-size: 0.75rem;
  color: #ffa500;
  margin: 0;
}

/* ── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .calendario-view { padding: 1rem; }

  .day-cell { min-height: 64px; padding: 4px 3px; }

  .day-cell { min-height: 28px; padding: 3px 4px; }
  .day-num { font-size: 0.72rem; min-width: 20px; height: 20px; }
  .event-bar { font-size: 0; } /* hide text on mobile, keep colored bar */
  .ev-dot { display: none; }
  .week-events { min-height: 14px; }
  .event-bar { height: 10px; border-radius: 3px; padding: 0; }
  .legend { display: none; }

  .dow-header { font-size: 0.65rem; padding: 6px 2px; }
  .day-num { font-size: 0.72rem; min-width: 20px; height: 20px; }
  .legend, .header-actions .legend { display: none; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
