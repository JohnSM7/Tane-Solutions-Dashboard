<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import { useHomeData } from '../services/home';
import { authStore } from '../store/auth';

const router = useRouter();
const { kpis, activity, loading } = useHomeData();

const TIPO_ICON: Record<string, string> = { ticket: '🎫', lead: '💼', factura: '🧾' };

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

const now = new Date();
const greeting = computed(() => {
  const h = now.getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
});

const modules = [
  { name: 'Centro de Alertas',   route: '/alerts',     icon: '🚨', desc: 'Incidencias activas del sistema' },
  { name: 'Comercial',           route: '/commercial', icon: '💼', desc: 'Pipeline y gestión de leads' },
  { name: 'Financiero',          route: '/financial',  icon: '💰', desc: 'Facturas, proyectos y tesorería' },
  { name: 'Operaciones',         route: '/operations', icon: '⚙️', desc: 'Proyectos y carga del equipo' },
  { name: 'Soporte',             route: '/support',    icon: '🎫', desc: 'Tickets e infraestructura' },
  { name: 'Clientes',            route: '/clients',    icon: '👥', desc: 'Directorio CRM 360°' },
];
</script>

<template>
  <div class="view-container">

    <!-- Saludo -->
    <div class="header">
      <div>
        <h1>{{ greeting }}, {{ authStore.user?.name?.split(' ')[0] ?? 'Admin' }}</h1>
        <span class="subtitle">
          {{ now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
        </span>
      </div>
      <div v-if="kpis && kpis.alertasTotal > 0" class="alert-pill" @click="router.push('/alerts')">
        🚨 {{ kpis.alertasTotal }} alerta{{ kpis.alertasTotal > 1 ? 's' : '' }} activa{{ kpis.alertasTotal > 1 ? 's' : '' }}
      </div>
    </div>

    <div v-if="loading" class="loading-state">Cargando datos del sistema...</div>

    <template v-else-if="kpis">

      <!-- KPIs principales -->
      <div class="kpi-grid">
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Facturación este mes</span>
            <span class="kpi-value" style="color: var(--color-primary)">{{ fmt(kpis.facturacionMes) }}</span>
            <span class="kpi-trend" :class="kpis.tendenciaPct >= 0 ? 'up' : 'down'">
              {{ kpis.tendenciaPct >= 0 ? '▲' : '▼' }} {{ Math.abs(kpis.tendenciaPct) }}% vs mes anterior
            </span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Por cobrar</span>
            <span class="kpi-value" :style="{ color: kpis.facturasVencidas > 0 ? '#ff4444' : '#facc15' }">
              {{ fmt(kpis.porCobrar) }}
            </span>
            <span v-if="kpis.facturasVencidas > 0" class="kpi-sub danger">
              {{ kpis.facturasVencidas }} factura{{ kpis.facturasVencidas > 1 ? 's' : '' }} vencida{{ kpis.facturasVencidas > 1 ? 's' : '' }}
            </span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Clientes activos</span>
            <span class="kpi-value">{{ kpis.clientesActivos }}</span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Pipeline comercial</span>
            <span class="kpi-value" style="color: var(--color-primary)">{{ fmt(kpis.pipelineValor) }}</span>
            <span class="kpi-sub">Leads activos en negociación</span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Proyectos activos</span>
            <span class="kpi-value" :style="{ color: kpis.proyectosEnRiesgo > 0 ? '#ff4444' : 'var(--color-primary)' }">
              {{ kpis.proyectosActivos }}
            </span>
            <span v-if="kpis.proyectosEnRiesgo > 0" class="kpi-sub danger">
              {{ kpis.proyectosEnRiesgo }} en riesgo / retrasado
            </span>
            <span v-else class="kpi-sub ok">Sin alertas</span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Carga del equipo</span>
            <span class="kpi-value"
              :style="{ color: kpis.teamLoadPct > 85 ? '#ff4444' : kpis.teamLoadPct > 65 ? '#ffa500' : 'var(--color-primary)' }">
              {{ kpis.teamLoadPct }}%
            </span>
            <div class="mini-bar-bg">
              <div class="mini-bar" :style="{
                width: kpis.teamLoadPct + '%',
                background: kpis.teamLoadPct > 85 ? '#ff4444' : kpis.teamLoadPct > 65 ? '#ffa500' : 'var(--color-primary)',
              }"></div>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Tickets abiertos</span>
            <span class="kpi-value" :style="{ color: kpis.ticketsAbiertos > 0 ? '#ffa500' : '#4ade80' }">
              {{ kpis.ticketsAbiertos }}
            </span>
            <span class="kpi-sub" :class="kpis.ticketsAbiertos === 0 ? 'ok' : ''">
              {{ kpis.ticketsAbiertos === 0 ? 'Todo resuelto' : 'Pendientes de resolver' }}
            </span>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div class="kpi">
            <span class="kpi-label">Tareas pendientes</span>
            <span class="kpi-value" :style="{ color: kpis.tareasPendientes > 0 ? '#ffa500' : '#4ade80' }">
              {{ kpis.tareasPendientes }}
            </span>
            <button class="kpi-link" @click="router.push('/tareas')">Ver tablero →</button>
          </div>
        </DashboardCard>
      </div>

      <!-- Actividad reciente + acceso a módulos -->
      <div class="bottom-grid">

      <DashboardCard title="Actividad reciente">
        <div v-if="activity.length === 0" class="empty-state">Sin actividad reciente</div>
        <div v-else class="activity-feed">
          <div
            v-for="item in activity"
            :key="item.id"
            class="activity-row"
            @click="router.push(item.link)"
          >
            <span class="activity-icon">{{ TIPO_ICON[item.tipo] }}</span>
            <div class="activity-body">
              <span class="activity-title">{{ item.titulo }}</span>
              <span class="activity-sub">{{ item.subtitulo }}</span>
            </div>
            <span class="activity-badge" :style="{ color: item.color, borderColor: item.color + '55' }">
              {{ item.estado }}
            </span>
          </div>
        </div>
      </DashboardCard>

      <!-- Acceso rápido a módulos -->
      <DashboardCard title="Módulos">
        <div class="modules-grid">
          <div
            v-for="m in modules"
            :key="m.route"
            class="module-card"
            @click="router.push(m.route)"
          >
            <span class="module-icon">{{ m.icon }}</span>
            <div class="module-info">
              <span class="module-name">{{ m.name }}</span>
              <span class="module-desc">{{ m.desc }}</span>
            </div>
            <span class="module-arrow">→</span>
          </div>
        </div>
      </DashboardCard>

      </div><!-- end bottom-grid -->

    </template>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.loading-state  { color: var(--color-text-muted); font-style: italic; padding: 2rem; text-align: center; }

.header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
.header h1 { font-size: 1.8rem; margin-bottom: 0.3rem; }
.subtitle  { color: var(--color-text-muted); font-size: 0.95rem; text-transform: capitalize; }

.alert-pill {
  background: rgba(255,68,68,0.15);
  border: 1px solid rgba(255,68,68,0.4);
  color: #f87171;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.alert-pill:hover { background: rgba(255,68,68,0.25); }

/* KPI grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
.kpi { display: flex; flex-direction: column; gap: 0.25rem; }
.kpi-label { font-size: 0.82rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.kpi-value { font-size: 1.8rem; font-weight: 800; line-height: 1.1; }
.kpi-sub   { font-size: 0.78rem; color: var(--color-text-muted); }
.kpi-sub.danger { color: #f87171; }
.kpi-sub.ok     { color: #4ade80; }
.kpi-trend      { font-size: 0.78rem; font-weight: 600; }
.kpi-trend.up   { color: #4ade80; }
.kpi-trend.down { color: #f87171; }

.mini-bar-bg { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 6px; }
.mini-bar    { height: 4px; border-radius: 2px; transition: width 0.4s; }

.kpi-link {
  background: none; border: none; color: var(--color-primary); font-size: 0.78rem;
  font-weight: 600; cursor: pointer; padding: 0; margin-top: 2px; text-align: left;
}
.kpi-link:hover { text-decoration: underline; }

.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.activity-feed { display: flex; flex-direction: column; gap: 0; }
.activity-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer; border-radius: 4px;
  transition: background 0.15s;
}
.activity-row:last-child { border-bottom: none; }
.activity-row:hover { background: rgba(255,255,255,0.04); }
.activity-icon { font-size: 1.1rem; flex-shrink: 0; }
.activity-body { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.activity-title { font-size: 0.88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-sub   { font-size: 0.75rem; color: var(--color-text-muted); }
.activity-badge {
  font-size: 0.72rem; font-weight: 600; padding: 2px 8px;
  border-radius: 10px; border: 1px solid; white-space: nowrap; flex-shrink: 0;
}
.empty-state { color: var(--color-text-muted); font-size: 0.88rem; padding: 1rem 0.5rem; }

/* Modules */
.modules-grid { display: flex; flex-direction: column; gap: 0; }
.module-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}
.module-card:last-child { border-bottom: none; }
.module-card:hover { background: rgba(255,255,255,0.04); }
.module-icon { font-size: 1.4rem; flex-shrink: 0; }
.module-info { display: flex; flex-direction: column; flex: 1; }
.module-name { font-weight: 600; font-size: 0.95rem; }
.module-desc { font-size: 0.8rem; color: var(--color-text-muted); }
.module-arrow { color: var(--color-text-muted); }

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .kpi-value { font-size: 1.4rem; }
  .bottom-grid { grid-template-columns: 1fr; }
}
</style>
