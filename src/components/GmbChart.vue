<script setup lang="ts">
import { computed } from 'vue';
import type { GmbSnapshot } from '../services/gmbHistorico';

const props = defineProps<{
  snapshots: GmbSnapshot[];
  sedeId?: number;
}>();

const data = computed(() => {
  const list = props.sedeId
    ? props.snapshots.filter(s => s.sede_id === props.sedeId)
    : props.snapshots;

  // Si hay varias sedes, promediar por fecha
  if (!props.sedeId) {
    const byDate = new Map<string, { sum: number; count: number; reviews: number }>();
    for (const s of list) {
      const entry = byDate.get(s.fecha) ?? { sum: 0, count: 0, reviews: 0 };
      entry.sum     += s.gmb_rating;
      entry.count   += 1;
      entry.reviews += s.gmb_reviews;
      byDate.set(s.fecha, entry);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, v]) => ({
        fecha,
        rating:  Math.round((v.sum / v.count) * 10) / 10,
        reviews: v.reviews,
      }));
  }

  return list.map(s => ({ fecha: s.fecha, rating: s.gmb_rating, reviews: s.gmb_reviews }));
});

const W = 600;
const H = 120;
const PAD = { top: 12, right: 16, bottom: 24, left: 36 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

const MIN_RATING = 3;
const MAX_RATING = 5;

const points = computed(() => {
  if (data.value.length < 2) return [];
  return data.value.map((d, i) => {
    const x = PAD.left + (i / (data.value.length - 1)) * chartW;
    const y = PAD.top + chartH - ((d.rating - MIN_RATING) / (MAX_RATING - MIN_RATING)) * chartH;
    return { x, y, ...d };
  });
});

const polyline = computed(() =>
  points.value.map(p => `${p.x},${p.y}`).join(' ')
);

const area = computed(() => {
  if (points.value.length < 2) return '';
  const first = points.value[0]!;
  const last  = points.value[points.value.length - 1]!;
  const base  = PAD.top + chartH;
  return `M${first.x},${base} ` +
    points.value.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${last.x},${base} Z`;
});

const yLabels = [3, 3.5, 4, 4.5, 5];

const xLabels = computed(() => {
  if (data.value.length === 0) return [];
  const step = Math.max(1, Math.floor(data.value.length / 5));
  return data.value
    .filter((_, i) => i % step === 0 || i === data.value.length - 1)
    .map((d) => {
      const origIdx = data.value.indexOf(d);
      const x = PAD.left + (origIdx / (data.value.length - 1)) * chartW;
      const label = new Date(d.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      return { x, label };
    });
});
</script>

<template>
  <div class="gmb-chart-wrap">
    <div v-if="snapshots.length === 0" class="empty">
      Sin histórico aún. Pulsa "Guardar snapshot" para registrar los valores actuales.
    </div>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="gmb-svg" preserveAspectRatio="none">
      <!-- Grid lines -->
      <line v-for="y in yLabels" :key="y"
        :x1="PAD.left" :x2="PAD.left + chartW"
        :y1="PAD.top + chartH - ((y - MIN_RATING) / (MAX_RATING - MIN_RATING)) * chartH"
        :y2="PAD.top + chartH - ((y - MIN_RATING) / (MAX_RATING - MIN_RATING)) * chartH"
        stroke="rgba(255,255,255,0.07)" stroke-width="1"
      />
      <!-- Y labels -->
      <text v-for="y in yLabels" :key="'l'+y"
        :x="PAD.left - 6"
        :y="PAD.top + chartH - ((y - MIN_RATING) / (MAX_RATING - MIN_RATING)) * chartH + 4"
        text-anchor="end" font-size="9" fill="#666"
      >{{ y }}</text>

      <!-- Area fill -->
      <path :d="area" fill="rgba(227,255,4,0.06)" />

      <!-- Line -->
      <polyline :points="polyline" fill="none" stroke="#E3FF04" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

      <!-- Dots -->
      <circle v-for="p in points" :key="p.fecha"
        :cx="p.x" :cy="p.y" r="3" fill="#E3FF04"
      >
        <title>{{ p.fecha }}: ⭐ {{ p.rating }} ({{ p.reviews }} reseñas)</title>
      </circle>

      <!-- X labels -->
      <text v-for="lbl in xLabels" :key="lbl.label"
        :x="lbl.x" :y="H - 4"
        text-anchor="middle" font-size="9" fill="#555"
      >{{ lbl.label }}</text>
    </svg>

    <!-- Último valor destacado -->
    <div v-if="data.length > 0" class="last-value">
      <span class="rating-big">⭐ {{ data[data.length - 1]!.rating }}</span>
      <span class="reviews-small">{{ data[data.length - 1]!.reviews }} reseñas</span>
      <span v-if="data.length >= 2" class="delta"
        :class="data[data.length-1]!.rating >= data[data.length-2]!.rating ? 'up' : 'down'">
        {{ data[data.length-1]!.rating >= data[data.length-2]!.rating ? '▲' : '▼' }}
        {{ Math.abs(Math.round((data[data.length-1]!.rating - data[data.length-2]!.rating) * 10) / 10) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.gmb-chart-wrap { display: flex; flex-direction: column; gap: 0.75rem; }
.empty          { color: var(--color-text-muted); font-size: 0.85rem; font-style: italic; padding: 1rem 0; }
.gmb-svg        { width: 100%; height: 120px; overflow: visible; }
.last-value     { display: flex; align-items: center; gap: 0.75rem; }
.rating-big     { font-size: 1.3rem; font-weight: 800; color: var(--color-primary); }
.reviews-small  { font-size: 0.82rem; color: var(--color-text-muted); }
.delta          { font-size: 0.82rem; font-weight: 700; }
.delta.up       { color: #4ade80; }
.delta.down     { color: #f87171; }
</style>
