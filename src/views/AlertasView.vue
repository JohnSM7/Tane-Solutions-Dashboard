<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import { useAlertas, type Alerta } from '../services/alerts';

const router = useRouter();
const { alertas, loading, lastUpdated, reload } = useAlertas();

const altas  = computed(() => alertas.value.filter(a => a.severidad === 'alta'));
const medias = computed(() => alertas.value.filter(a => a.severidad === 'media'));

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '';
  return lastUpdated.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
});

let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  pollInterval = setInterval(reload, 30_000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});

const tipoConfig: Record<Alerta['tipo'], { label: string; icon: string; color: string }> = {
  financiero:      { label: 'Financiero',      icon: '💰', color: '#ff4444' },
  proyecto:        { label: 'Proyecto',         icon: '📋', color: '#ffa500' },
  gmb:             { label: 'Google My Business', icon: '⭐', color: '#e3ff04' },
  soporte:         { label: 'Soporte',          icon: '🎫', color: '#f87171' },
  infraestructura: { label: 'Infraestructura',  icon: '🖥️', color: '#a78bfa' },
};

const navigate = (enlace: string) => router.push(enlace);

const resumen = computed(() => {
  const map: Record<string, number> = {};
  for (const a of alertas.value) {
    map[a.tipo] = (map[a.tipo] ?? 0) + 1;
  }
  return Object.entries(map).map(([tipo, count]) => ({
    ...tipoConfig[tipo as Alerta['tipo']],
    count,
  }));
});
</script>

<template>
  <div class="view-container">
    <div class="header">
      <div>
        <h1>Centro de Alertas</h1>
        <span class="subtitle">
          <span v-if="!loading">
            <strong :class="altas.length > 0 ? 'text-danger' : 'text-ok'">
              {{ altas.length }} crítica(s)
            </strong>
            · {{ medias.length }} aviso(s) · {{ alertas.length }} total
          </span>
        </span>
      </div>
      <div class="header-right">
        <span v-if="lastUpdatedText" class="last-updated">Actualizado: {{ lastUpdatedText }}</span>
        <button class="btn-refresh" :class="{ spinning: loading }" @click="reload" :disabled="loading" title="Actualizar ahora">
          ↻
        </button>
      </div>
    </div>

    <!-- Resumen por categoría -->
    <div v-if="!loading && alertas.length > 0" class="resumen-grid">
      <div v-for="r in resumen" :key="r.label" class="resumen-card">
        <span class="resumen-icon">{{ r.icon }}</span>
        <div>
          <div class="resumen-count" :style="{ color: r.color }">{{ r.count }}</div>
          <div class="resumen-label">{{ r.label }}</div>
        </div>
      </div>
    </div>

    <!-- Sin alertas -->
    <div v-if="!loading && alertas.length === 0" class="all-clear">
      <div class="all-clear-icon">✅</div>
      <p class="all-clear-title">Todo en orden</p>
      <p class="all-clear-sub">No hay alertas activas en ningún módulo.</p>
    </div>

    <!-- Alertas críticas -->
    <DashboardCard v-if="!loading && altas.length > 0" title="Críticas — Acción inmediata">
      <div class="alert-list">
        <div
          v-for="a in altas"
          :key="a.id"
          class="alert-row alta"
          @click="navigate(a.enlace)"
        >
          <span class="alert-icon">{{ tipoConfig[a.tipo].icon }}</span>
          <div class="alert-body">
            <span class="alert-titulo">{{ a.titulo }}</span>
            <span class="alert-desc">{{ a.descripcion }}</span>
          </div>
          <span class="alert-badge alta">CRÍTICO</span>
          <span class="alert-arrow">→</span>
        </div>
      </div>
    </DashboardCard>

    <!-- Avisos -->
    <DashboardCard v-if="!loading && medias.length > 0" title="Avisos — Revisar pronto">
      <div class="alert-list">
        <div
          v-for="a in medias"
          :key="a.id"
          class="alert-row media"
          @click="navigate(a.enlace)"
        >
          <span class="alert-icon">{{ tipoConfig[a.tipo].icon }}</span>
          <div class="alert-body">
            <span class="alert-titulo">{{ a.titulo }}</span>
            <span class="alert-desc">{{ a.descripcion }}</span>
          </div>
          <span class="alert-badge media">AVISO</span>
          <span class="alert-arrow">→</span>
        </div>
      </div>
    </DashboardCard>

    <div v-if="loading" class="loading-state">Analizando el estado del sistema...</div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--color-text-muted); font-size: 1.1rem; }
.text-danger { color: #ff4444; }
.text-ok { color: #4ade80; }
.header-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; padding-top: 0.25rem; }
.last-updated { font-size: 0.75rem; color: var(--color-text-muted); }
.btn-refresh {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  width: 34px; height: 34px;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, transform 0.3s;
  display: flex; align-items: center; justify-content: center;
}
.btn-refresh:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); }
.btn-refresh.spinning { animation: spin 0.8s linear infinite; }
.btn-refresh:disabled { opacity: 0.4; cursor: default; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem; text-align: center; }

/* Resumen */
.resumen-grid {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.resumen-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1rem 1.5rem;
  flex: 1;
  min-width: 160px;
}
.resumen-icon { font-size: 1.8rem; }
.resumen-count { font-size: 1.8rem; font-weight: 800; line-height: 1; }
.resumen-label { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px; }

/* Alert list */
.alert-list { display: flex; flex-direction: column; gap: 0; }
.alert-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}
.alert-row:last-child { border-bottom: none; }
.alert-row:hover { background: rgba(255,255,255,0.04); }
.alert-row.alta:hover { background: rgba(255,68,68,0.06); }
.alert-row.media:hover { background: rgba(255,165,0,0.06); }

.alert-icon { font-size: 1.4rem; flex-shrink: 0; }
.alert-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.alert-titulo { font-weight: 600; font-size: 0.95rem; color: var(--color-text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.alert-desc { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 2px; }

.alert-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}
.alert-badge.alta { background: rgba(255,68,68,0.2); color: #f87171; }
.alert-badge.media { background: rgba(255,165,0,0.2); color: #ffa500; }
.alert-arrow { color: var(--color-text-muted); font-size: 1rem; flex-shrink: 0; }

/* All clear */
.all-clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.all-clear-icon { font-size: 4rem; margin-bottom: 1rem; }
.all-clear-title { font-size: 1.4rem; font-weight: 700; color: #4ade80; margin: 0 0 0.5rem; }
.all-clear-sub { color: var(--color-text-muted); margin: 0; }

@media (max-width: 768px) {
  .resumen-grid { flex-direction: column; }
  .alert-titulo { white-space: normal; }
}
</style>
