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
  fecha_fin: string | null;
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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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
const currentMonth = ref(today.getMonth()); // 0-indexed

const events     = ref<CalEvent[]>([]);
const loading    = ref(true);
const selectedDay = ref<string | null>(null); // YYYY-MM-DD

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value -= 1;
  } else {
    currentMonth.value -= 1;
  }
  selectedDay.value = null;
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value += 1;
  } else {
    currentMonth.value += 1;
  }
  selectedDay.value = null;
}

const monthLabel = computed(
  () => `${MESES_ES[currentMonth.value]} ${currentYear.value}`
);

// ---------------------------------------------------------------------------
// Calendar grid
// ---------------------------------------------------------------------------

interface DayCell {
  date: Date;
  key: string;        // YYYY-MM-DD
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const gridDays = computed<DayCell[]>(() => {
  const year  = currentYear.value;
  const month = currentMonth.value;

  // First day of month (0=Sun…6=Sat). Convert to Mon-based (0=Mon…6=Sun).
  const firstDayRaw = new Date(year, month, 1).getDay();
  const startOffset  = (firstDayRaw === 0 ? 6 : firstDayRaw - 1);

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
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Event map (keyed by YYYY-MM-DD)
// ---------------------------------------------------------------------------

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
// Fetch data
// ---------------------------------------------------------------------------

async function fetchEvents() {
  loading.value = true;
  try {
    const [tareasRes, proyectosRes] = await Promise.all([
      supabase
        .from('tareas')
        .select('id, titulo, estado, prioridad, fecha_limite')
        .not('fecha_limite', 'is', null),
      supabase
        .from('proyectos')
        .select('id, nombre, estado, fecha_fin')
        .not('fecha_fin', 'is', null)
        .neq('estado', 'Completado'),
    ]);

    const result: CalEvent[] = [];

    for (const t of (tareasRes.data ?? []) as Tarea[]) {
      if (!t.fecha_limite) continue;
      result.push({
        id:       t.id,
        type:     'tarea',
        title:    t.titulo,
        color:    PRIORIDAD_COLOR[t.prioridad] ?? '#94a3b8',
        estado:   t.estado,
        prioridad: t.prioridad,
        date:     t.fecha_limite.slice(0, 10),
      });
    }

    for (const p of (proyectosRes.data ?? []) as Proyecto[]) {
      if (!p.fecha_fin) continue;
      result.push({
        id:     p.id,
        type:   'proyecto',
        title:  p.nombre,
        color:  ESTADO_COLORS[p.estado] ?? '#e3ff04',
        estado: p.estado,
        date:   p.fecha_fin.slice(0, 10),
      });
    }

    events.value = result;
  } catch (err) {
    console.error('CalendarioView: error fetching events', err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchEvents);

// ---------------------------------------------------------------------------
// Day click
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
    <!-- ------------------------------------------------------------------ -->
    <!-- Header card                                                          -->
    <!-- ------------------------------------------------------------------ -->
    <DashboardCard title="Calendario">
      <template #actions>
        <div class="legend">
          <span class="legend-item">
            <span class="legend-dot tarea-dot"></span> 🎫 Tarea (deadline)
          </span>
          <span class="legend-item">
            <span class="legend-dot proyecto-dot"></span> 📁 Proyecto (fecha fin)
          </span>
        </div>
      </template>

      <!-- Navigation -->
      <div class="nav-row">
        <button class="nav-btn" @click="prevMonth">← Anterior</button>
        <h2 class="month-label">{{ monthLabel }}</h2>
        <button class="nav-btn" @click="nextMonth">Siguiente →</button>
      </div>

      <div v-if="loading" class="loading-msg">Cargando eventos…</div>

      <div v-else class="calendar-layout">
        <!-- Calendar grid -->
        <div class="calendar-wrap">
          <!-- Day-of-week headers -->
          <div class="cal-grid">
            <div
              v-for="dia in DIAS_SEMANA"
              :key="dia"
              class="dow-header"
            >{{ dia }}</div>

            <!-- Day cells -->
            <div
              v-for="cell in gridDays"
              :key="cell.key"
              class="day-cell"
              :class="{
                'outside-month': !cell.isCurrentMonth,
                'is-today': cell.isToday,
                'is-selected': selectedDay === cell.key,
              }"
              @click="selectDay(cell)"
            >
              <!-- Day number -->
              <div class="day-num-wrap">
                <span
                  class="day-num"
                  :class="{ 'today-circle': cell.isToday }"
                >{{ cell.dayNum }}</span>
              </div>

              <!-- Event pills (up to 3) -->
              <div class="pills-wrap">
                <template v-for="(ev, idx) in eventsForDay(cell.key)" :key="ev.id">
                  <div
                    v-if="idx < 3"
                    class="pill"
                    :style="{ backgroundColor: ev.color + '22', borderLeft: `3px solid ${ev.color}`, color: ev.color }"
                  >
                    <span class="pill-icon">{{ ev.type === 'tarea' ? '🎫' : '📁' }}</span>
                    <span class="pill-text">{{ ev.title }}</span>
                  </div>
                </template>
                <div
                  v-if="eventsForDay(cell.key).length > 3"
                  class="pill pill-overflow"
                >+{{ eventsForDay(cell.key).length - 3 }} más</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar for selected day -->
        <aside v-if="selectedDay" class="day-sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">{{ selectedDayLabel }}</span>
            <button class="close-btn" @click="selectedDay = null">✕</button>
          </div>

          <div v-if="selectedDayEvents.length === 0" class="no-events">
            Sin eventos este día.
          </div>

          <ul v-else class="event-list">
            <li
              v-for="ev in selectedDayEvents"
              :key="ev.id"
              class="event-item"
              :style="{ borderLeft: `4px solid ${ev.color}` }"
            >
              <div class="event-icon">{{ ev.type === 'tarea' ? '🎫' : '📁' }}</div>
              <div class="event-details">
                <div class="event-title">{{ ev.title }}</div>
                <div class="event-meta">
                  <span class="meta-tag" :style="{ color: ev.color }">{{ ev.estado }}</span>
                  <span v-if="ev.prioridad" class="meta-tag muted">{{ ev.prioridad }}</span>
                  <span class="meta-tag muted type-label">
                    {{ ev.type === 'tarea' ? 'Tarea' : 'Proyecto' }}
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </DashboardCard>
  </div>
</template>

<style scoped>
/* -------------------------------------------------------------------------
   Layout
------------------------------------------------------------------------- */
.calendario-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* -------------------------------------------------------------------------
   Legend
------------------------------------------------------------------------- */
.legend {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}

.tarea-dot   { background: #ffa500; }
.proyecto-dot { background: #e3ff04; }

/* -------------------------------------------------------------------------
   Navigation row
------------------------------------------------------------------------- */
.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.month-label {
  font-size: 1.2rem;
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
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color 0.2s, background 0.2s;
  white-space: nowrap;
}

.nav-btn:hover {
  border-color: var(--color-primary);
  background: rgba(227, 255, 4, 0.08);
}

/* -------------------------------------------------------------------------
   Loading
------------------------------------------------------------------------- */
.loading-msg {
  text-align: center;
  color: var(--color-text-muted);
  padding: 3rem 0;
}

/* -------------------------------------------------------------------------
   Calendar layout (grid + sidebar)
------------------------------------------------------------------------- */
.calendar-layout {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.calendar-wrap {
  flex: 1;
  min-width: 0;
}

/* -------------------------------------------------------------------------
   Calendar grid
------------------------------------------------------------------------- */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-left: 1px solid var(--color-border);
  border-top: 1px solid var(--color-border);
}

.dow-header {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  text-align: center;
  padding: 0.4rem 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-lighter);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.day-cell {
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  min-height: 100px;
  padding: 4px 5px 5px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-cell:hover {
  background: rgba(227, 255, 4, 0.04);
}

.day-cell.outside-month {
  opacity: 0.3;
}

.day-cell.is-selected {
  border: 2px solid var(--color-primary) !important;
  /* compensate border so grid doesn't jump */
  margin: -1px;
  z-index: 1;
}

/* -------------------------------------------------------------------------
   Day number
------------------------------------------------------------------------- */
.day-num-wrap {
  display: flex;
  justify-content: flex-end;
  padding-right: 2px;
}

.day-num {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1;
  padding: 2px 4px;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-circle {
  background: var(--color-primary);
  color: #000;
  font-weight: 700;
}

/* -------------------------------------------------------------------------
   Pills
------------------------------------------------------------------------- */
.pills-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.pill {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 3px;
  line-height: 1.3;
}

.pill-icon {
  flex-shrink: 0;
  font-size: 0.65rem;
}

.pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-overflow {
  background: var(--color-bg-lighter) !important;
  border-left: 3px solid var(--color-border) !important;
  color: var(--color-text-muted) !important;
}

/* -------------------------------------------------------------------------
   Day sidebar
------------------------------------------------------------------------- */
.day-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: var(--color-bg-lighter);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  animation: slideIn 0.18s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.sidebar-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-light);
  flex: 1;
}

.close-btn {
  background: transparent;
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
  padding: 1.5rem 0;
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.event-item {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  background: var(--color-bg-card);
  border-radius: 6px;
  padding: 0.5rem 0.6rem 0.5rem 0.7rem;
  /* border-left applied inline */
}

.event-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.event-details {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 0.82rem;
  color: var(--color-text-light);
  font-weight: 500;
  word-break: break-word;
  line-height: 1.35;
}

.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.3rem;
}

.meta-tag {
  font-size: 0.7rem;
  background: var(--color-bg-lighter);
  border-radius: 3px;
  padding: 1px 5px;
  font-weight: 500;
}

.meta-tag.muted {
  color: var(--color-text-muted);
}

.type-label {
  font-style: italic;
}

/* -------------------------------------------------------------------------
   Mobile
------------------------------------------------------------------------- */
@media (max-width: 768px) {
  .calendario-view { padding: 1rem; }

  .calendar-layout {
    flex-direction: column;
  }

  .day-sidebar {
    width: 100%;
    box-sizing: border-box;
  }

  .day-cell {
    min-height: 60px;
    padding: 3px 3px 3px;
  }

  /* On mobile, pills collapse to colored dots only */
  .pill {
    width: 10px;
    height: 10px;
    min-width: 10px;
    padding: 0;
    border-radius: 50%;
    border-left: none !important;
    background-color: currentColor !important;
  }

  .pill-text,
  .pill-icon {
    display: none;
  }

  .pills-wrap {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 3px;
    padding-top: 2px;
  }

  .pill-overflow {
    font-size: 0.6rem;
    background: transparent !important;
    color: var(--color-text-muted) !important;
    width: auto;
    height: auto;
    border-radius: 0;
    padding: 0;
    display: block;
    white-space: nowrap;
  }

  .pill-overflow .pill-icon { display: none; }

  .legend { display: none; }

  .month-label { font-size: 1rem; }

  .nav-btn { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
}
</style>
