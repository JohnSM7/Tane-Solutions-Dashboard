<script setup lang="ts">
defineProps<{
  data: {
    month: string;
    current: number;
    prev: number;
    currentRaw: number;
    prevRaw: number;
  }[];
}>();

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
</script>

<template>
  <div class="chart-wrap">
    <div class="chart-legend">
      <span class="legend-dot current"></span><span>Este año</span>
      <span class="legend-dot prev"></span><span>Año anterior</span>
    </div>

    <div class="bars">
      <div v-for="col in data" :key="col.month" class="bar-col">
        <div class="bar-pair">
          <div class="bar-group">
            <div
              class="bar bar-prev"
              :style="{ height: col.prev + '%' }"
              :title="`Año anterior: ${fmt(col.prevRaw)}`"
            ></div>
            <div
              class="bar bar-current"
              :style="{ height: col.current + '%' }"
              :title="`Este año: ${fmt(col.currentRaw)}`"
            ></div>
          </div>
          <div class="bar-values">
            <span v-if="col.currentRaw > 0" class="val-current">{{ fmt(col.currentRaw) }}</span>
          </div>
        </div>
        <span class="bar-label">{{ col.month }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap { display: flex; flex-direction: column; gap: 0.75rem; }

.chart-legend {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.78rem; color: var(--color-text-muted);
}
.legend-dot {
  width: 10px; height: 10px; border-radius: 2px; display: inline-block;
}
.legend-dot.current { background: var(--color-primary); }
.legend-dot.prev    { background: #3a3a3a; }

.bars {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 160px;
  padding-bottom: 1.5rem;
  position: relative;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  gap: 0.25rem;
}

.bar-pair {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  flex: 1;
  justify-content: flex-end;
}

.bar-group {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  transition: height 0.4s ease;
}
.bar-prev    { background: #2a2a2a; border: 1px solid #3a3a3a; }
.bar-current { background: var(--color-primary); opacity: 0.9; }
.bar-current:hover { opacity: 1; }
.bar-prev:hover    { background: #3a3a3a; }

.bar-values {
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.val-current {
  font-size: 0.6rem;
  color: var(--color-primary);
  font-weight: 700;
  white-space: nowrap;
}

.bar-label {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  position: absolute;
  bottom: 0;
  white-space: nowrap;
}
</style>
