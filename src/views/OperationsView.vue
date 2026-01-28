<script setup lang="ts">
import DashboardCard from '../components/DashboardCard.vue';


const kpis = [
  { label: 'Proyectos Activos', value: '12', trend: '3 en riesgo', color: '#ff4444' },
  { label: 'Tiempo Medio Entrega', value: '24 días', trend: '-2 días vs media', color: '#e3ff04' },
  { label: 'Carga del Equipo', value: '85%', trend: 'Alta', color: '#ffa500' }, // Orange for warning
  { label: 'Entregas este mes', value: '4', trend: 'On track', color: '#e3ff04' },
];

const projects = [
  { name: 'Rediseño Web Corp', client: 'Alpha Ind', status: 'Retrasado', color: '#ff4444' },
  { name: 'App Móvil iOS', client: 'Beta Start', status: 'En riesgo', color: '#ff4444' },
  { name: 'Landing Page Campaña', client: 'Gamma Ltd', status: 'Bloqueado', color: '#ffa500' }, // Yellow
  { name: 'Migración Servidor', client: 'Delta Systems', status: 'En curso', color: '#e3ff04' },
  { name: 'SEO Trimestral', client: 'Epsilon', status: 'En curso', color: '#e3ff04' },
  { name: 'Mantenimiento Anual', client: 'Zeta Corp', status: 'En curso', color: '#e3ff04' },
];

const teamLoad = [
  { name: 'Ana (Diseño)', load: 95, color: '#ff4444' },
  { name: 'Carlos (Frontend)', load: 60, color: '#e3ff04' },
  { name: 'Elena (Backend)', load: 40, color: '#e3ff04' },
  { name: 'David (PM)', load: 80, color: '#ffa500' },
];
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo de Operaciones</h1>
      <span class="subtitle">Gestión de Proyectos</span>
    </div>

    <!-- KPIs Grid -->
    <div class="metrics-grid">
      <DashboardCard v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-item">
          <span class="kpi-label">{{ kpi.label }}</span>
          <div class="kpi-value-row">
            <span class="kpi-value">{{ kpi.value }}</span>
            <span class="kpi-trend" :style="{ color: kpi.color }">{{ kpi.trend }}</span>
          </div>
        </div>
      </DashboardCard>
    </div>

    <!-- Main Content -->
    <div class="content-grid">
      <!-- Active Projects -->
      <DashboardCard title="Estado de Proyectos">
        <div class="projects-list">
            <div v-for="project in projects" :key="project.name" class="project-item">
                <div class="project-info">
                    <span class="project-name">{{ project.name }}</span>
                    <span class="client-name">{{ project.client }}</span>
                </div>
                <span class="status-badge" :style="{ borderColor: project.color, color: project.color }">
                    {{ project.status }}
                </span>
            </div>
        </div>
      </DashboardCard>

      <!-- Team Workload -->
      <DashboardCard title="Carga de Trabajo del Equipo">
        <div class="team-grid">
            <div v-for="member in teamLoad" :key="member.name" class="team-member">
                <div class="member-info">
                    <span class="member-name">{{ member.name }}</span>
                    <span class="member-load-value">{{ member.load }}%</span>
                </div>
                <div class="load-bar-bg">
                    <div class="load-bar-fill" :style="{ width: member.load + '%', backgroundColor: member.color }"></div>
                </div>
            </div>
        </div>
      </DashboardCard>
    </div>
    
  </div>
</template>

<style scoped>
/* Reusing common styles */
.view-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.kpi-item {
  display: flex;
  flex-direction: column;
}

.kpi-label {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
}

.kpi-value {
    font-size: 2rem;
    font-weight: 700;
    margin-right: 1rem;
}

.kpi-trend {
    font-size: 0.8rem;
    font-weight: 600;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 900px) {
    .content-grid {
        grid-template-columns: 1fr;
    }
}

/* Projects List */
.projects-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.project-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background-color: rgba(255,255,255,0.02);
    border-radius: 8px;
    border-left: 2px solid transparent; /* Potential accent */
}

.project-info {
    display: flex;
    flex-direction: column;
}

.project-name {
    font-weight: 600;
    font-size: 1rem;
}

.client-name {
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border: 1px solid;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
}

/* Team Workload */
.team-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.member-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.load-bar-bg {
    width: 100%;
    height: 8px;
    background-color: #333;
    border-radius: 4px;
    overflow: hidden;
}

.load-bar-fill {
    height: 100%;
    transition: width 0.5s ease;
}
</style>
