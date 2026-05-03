<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import { supabase } from '../supabase';
import { ESTADO_COLORS } from '../services/operations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  fecha_limite: string | null;
}

interface Proyecto {
  id: string;
  nombre: string;
  estado: string;
  fecha_entrega_estimada: string | null;
}

interface CalEvent {
  id: string;
  type: 'tarea' | 'proyecto';
  title: string;
  color: string;
  estado: string;
  prioridad?: string;
  date: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORIDAD_COLOR: Record<string, string> = {
  Alta:  '#ff4444',
  Media: '#ffa500',
  Baja:  '#94a3b8',
};

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

const events      = ref<CalEvent[]>([]);
const loading     = ref(true);
const selectedDay = ref<string | null>(null);

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
// Calendar grid
// ---------------------------------------------------------------------------

interface DayCell {
  date: Date;
  key: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const gridDays = computed<DayCell[]>(() => {
  const year  = currentYear.value;
  const month = currentMonth.value;
  const firstDayRaw = new Date(year, month, 1).getDay();
  const startOffset = (firstDayRaw === 0 ? 6 : firstDayRaw - 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const days: DayCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    d.setHours(0, 0, 0, 0);
    const key = toDateKey(d);
    days.push({
      date: d,
      key,
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: d.getTime() === today.getTime(),
    });
  }
  return days;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const eventMap = computed<Record<string, CalEvent[]>>(() => {
  const map: Record<string, CalEvent[]> = {};
  for (const ev of events.value) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date]!.push(ev);
  }
  return map;
});

function eventsForDay(key: string): CalEvent[] {
  return eventMap.value[key] ?? [];
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchEvents() {
  loading.value = true;
  try {
    const [tareasRes, proyectosRes] = await Promise.all([
      supabase.from('tareas').select('id, titulo, estado, prioridad, fecha_limite').not('fecha_limite', 'is', null),
      supabase.from('proyectos').select('id, nombre, estado, fecha_entrega_estimada').not('fecha_entrega_estimada', 'is', null).neq('estado', 'Completado'),
    ]);

    const result: CalEvent[] = [];

    for (const t of (tareasRes.data ?? []) as Tarea[]) {
      if (!t.fecha_limite) continue;
      result.push({
        id: t.id, type: 'tarea', title: t.titulo,
        color: PRIORIDAD_COLOR[t.prioridad] ?? '#94a3b8',
        estado: t.estado, prioridad: t.prioridad,
        date: t.fecha_limite.slice(0, 10),
      });
    }

    for (const p of (proyectosRes.data ?? []) as Proyecto[]) {
      if (!p.fecha_entrega_estimada) continue;
      result.push({
        id: p.id, type: 'proyecto', title: p.nombre,
        color: ESTADO_COLORS[p.estado] ?? '#e3ff04',
        estado: p.estado,
        date: p.fecha_entrega_estimada.slice(0, 10),
      });
    }

    events.value = result;
  } catch (err) {
    console.error('CalendarioView fetch error', err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchEvents);

// ---------------------------------------------------------------------------
// Day selection
// ---------------------------------------------------------------------------

function selectDay(cell: DayCell) {
  selectedDay.value = selectedDay.value === cell.key ? null : cell.key;
}

const selectedDayEvents = computed<CalEvent[]>(() =>
  selectedDay.value ? (eventMap.value[selectedDay.value] ?? []) : []
);

const selectedDayLabel = computed<string>(() => {
  if (!selectedDay.value) return '';
  const d = new Date(selectedDay.value + 'T00:00:00');
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
});
</script>

<template>
  <div class="calendario-view">
    <DashboardCard title="Calendario">
      <template #actions>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot" style="background:#ffa500"></span>Tarea</span>
          <span class="legend-item"><span class="legend-dot" style="background:#e3ff04"></span>Proyecto</span>
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
          <div v-for="dia in DIAS_SEMANA" :key="dia" class="dow-header">{{ dia }}</div>

          <!-- Day cells -->
          <div
            v-for="cell in gridDays"
            :key="cell.key"
            class="day-cell"
            :class="{
              'outside-month': !cell.isCurrentMonth,
              'is-today':      cell.isToday,
              'is-selected':   selectedDay === cell.key,
            }"
            @click="selectDay(cell)"
          >
            <div class="day-num-wrap">
              <span class="day-num" :class="{ 'today-circle': cell.isToday }">{{ cell.dayNum }}</span>
            </div>

            <div class="pills-wrap">
              <div
                v-for="(ev, idx) in eventsForDay(cell.key)"
                :key="ev.id"
                class="pill"
                :class="{ 'pill-hidden': idx >= 2 }"
                :style="{ background: ev.color + '22', borderLeftColor: ev.color, color: ev.color }"
              >
                <span class="pill-text">{{ ev.title }}</span>
              </div>
              <div
                v-if="eventsForDay(cell.key).length > 2"
                class="pill pill-more"
              >+{{ eventsForDay(cell.key).length - 2 }}</div>
            </div>
          </div>
        </div>

        <!-- Selected day panel -->
        <div v-if="selectedDay" class="day-panel">
          <div class="day-panel-header">
            <span class="day-panel-title">{{ selectedDayLabel }}</span>
            <button class="close-btn" @click="selectedDay = null">✕</button>
          </div>

          <div v-if="selectedDayEvents.length === 0" class="no-events">Sin eventos este día.</div>

          <div v-else class="event-list">
            <div
              v-for="ev in selectedDayEvents"
              :key="ev.id"
              class="event-item"
              :style="{ borderLeftColor: ev.color }"
            >
              <div class="event-type-dot" :style="{ background: ev.color }"></div>
              <div class="event-details">
                <div class="event-title">{{ ev.title }}</div>
                <div class="event-meta">
                  <span class="ev-badge" :style="{ color: ev.color, background: ev.color + '22' }">{{ ev.estado }}</span>
                  <span v-if="ev.prioridad" class="ev-badge muted">{{ ev.prioridad }}</span>
                  <span class="ev-badge muted">{{ ev.type === 'tarea' ? 'Tarea' : 'Proyecto' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </DashboardCard>
  </div>
</template>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────────── */
.calendario-view {
  padding: 1.5rem;
}

/* ── Legend ────────────────────────────────────────────────────────────────── */
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
  text-align: center;
  flex: 1;
}

.nav-btn {
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  color: var(--color-text-light);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.nav-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-primary)11;
}

/* ── Calendar Grid ─────────────────────────────────────────────────────────── */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

/* ── Day-of-week headers ───────────────────────────────────────────────────── */
.dow-header {
  background: var(--color-bg-lighter);
  border-bottom: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  text-align: center;
  padding: 8px 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dow-header:last-child { border-right: none; }

/* ── Day cells ─────────────────────────────────────────────────────────────── */
.day-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  min-height: 110px;
  padding: 6px 5px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  transition: background 0.12s;
  overflow: hidden;
  position: relative;
}

/* Remove right border from last column */
.day-cell:nth-child(7n) { border-right: none; }

/* Remove bottom border from last row cells — Vue can't do nth-last-row easily,
   so we use the grid border on the container */
.day-cell:hover { background: var(--color-primary)07; }

.day-cell.outside-month { opacity: 0.28; }

.day-cell.is-today { background: var(--color-primary)09; }

/* Selected: use box-shadow inset — no layout impact */
.day-cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--color-primary);
  background: var(--color-primary)0d;
}

/* ── Day number ────────────────────────────────────────────────────────────── */
.day-num-wrap {
  display: flex;
  justify-content: flex-end;
}

.day-num {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1;
  padding: 3px 5px;
  border-radius: 50%;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-circle {
  background: var(--color-primary);
  color: #000;
  font-weight: 700;
}

/* ── Pills ─────────────────────────────────────────────────────────────────── */
.pills-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.pill {
  font-size: 0.68rem;
  padding: 2px 5px;
  border-radius: 3px;
  border-left: 3px solid;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.pill-more {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  padding: 0 2px;
  background: none !important;
  border-left: none !important;
}

/* ── Day panel (appears below calendar on click) ───────────────────────────── */
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

.day-panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-light);
}

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

.no-events {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
  padding: 1.25rem;
}

/* ── Event list in day panel ───────────────────────────────────────────────── */
.event-list {
  display: flex;
  flex-direction: column;
}

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

.event-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.event-details { flex: 1; min-width: 0; }

.event-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-light);
  line-height: 1.35;
  word-break: break-word;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.ev-badge {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 20px;
  font-weight: 500;
}

.ev-badge.muted {
  background: var(--color-bg-lighter);
  color: var(--color-text-muted);
}

/* ── Loading ───────────────────────────────────────────────────────────────── */
.loading-msg {
  text-align: center;
  color: var(--color-text-muted);
  padding: 3rem 0;
}

/* ── Mobile ────────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .calendario-view { padding: 1rem; }

  .day-cell {
    min-height: 64px;
    padding: 4px 3px;
  }

  .pill {
    font-size: 0;        /* hide text */
    width: 8px;
    height: 8px;
    min-height: 8px;
    border-radius: 50%;
    border-left: none;
    padding: 0;
    flex-shrink: 0;
    background-color: currentColor !important;
  }

  .pill-more {
    font-size: 0.6rem;
    width: auto;
    height: auto;
    border-radius: 0;
    background: none !important;
  }

  .pills-wrap {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
  }

  .dow-header {
    font-size: 0.65rem;
    padding: 6px 2px;
  }

  .day-num { font-size: 0.72rem; min-width: 20px; height: 20px; }

  .legend { display: none; }
}
</style>
