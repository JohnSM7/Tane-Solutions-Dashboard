<script setup lang="ts">
import DashboardCard from '../components/DashboardCard.vue';

const kpis = [
  { label: 'Incidencias Abiertas', value: '3', trend: 'Bajo control', color: '#e3ff04' },
  { label: 'Tiempo 1ª Respuesta', value: '45 min', trend: '-10 min vs objetivo', color: '#e3ff04' },
  { label: 'Tasa de Cancelación', value: '1.2%', trend: '+0.1%', color: '#e3ff04' },
  { label: 'Satisfacción Cliente', value: '4.8/5', trend: 'Estable', color: '#ffffff' },
];

const servers = [
  { name: 'Web Principal (tanesolutions.com)', status: 'Online', uptime: '99.9%', color: '#e3ff04' },
  { name: 'Panel Clientes (app.tane.so)', status: 'Online', uptime: '99.5%', color: '#e3ff04' },
  { name: 'Servidor Correo', status: 'Mantenimiento', uptime: '98.2%', color: '#ffa500' },
  { name: 'Base de Datos Primaria', status: 'Online', uptime: '100%', color: '#e3ff04' },
];

const tickets = [
  { id: '#1024', subject: 'Error en formulario de contacto', client: 'Alpha Ind', priority: 'Alta', time: 'Hace 2h' },
  { id: '#1023', subject: 'Actualización de contenido', client: 'Gamma Ltd', priority: 'Baja', time: 'Hace 5h' },
  { id: '#1022', subject: 'Problemas de acceso', client: 'Epsilon', priority: 'Media', time: 'Hace 1d' },
];
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo de Soporte y Calidad</h1>
      <span class="subtitle">Satisfacción y Retención</span>
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
      <!-- Server Status -->
      <DashboardCard title="Estado de Servidores">
        <div class="servers-list">
            <div v-for="server in servers" :key="server.name" class="server-item">
                <div class="server-info">
                    <div class="server-name-row">
                        <div class="status-dot" :style="{ backgroundColor: server.color }"></div>
                        <span class="server-name">{{ server.name }}</span>
                    </div>
                    <span class="server-uptime">Uptime: {{ server.uptime }}</span>
                </div>
                <span class="status-text" :style="{ color: server.color }">{{ server.status }}</span>
            </div>
        </div>
      </DashboardCard>

      <!-- Recent Tickets -->
      <DashboardCard title="Últimos Tickets">
        <div class="table-responsive">
            <table class="tickets-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Asunto</th>
                        <th>Prioridad</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="ticket in tickets" :key="ticket.id">
                        <td class="ticket-id">{{ ticket.id }}</td>
                        <td>
                            <div class="ticket-subject">{{ ticket.subject }}</div>
                            <div class="ticket-client">{{ ticket.client }} • {{ ticket.time }}</div>
                        </td>
                        <td>
                            <span class="priority-badge" :class="ticket.priority.toLowerCase()">
                                {{ ticket.priority }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
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

/* Server Status */
.servers-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.server-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background-color: rgba(255,255,255,0.02);
    border-radius: 8px;
}

.server-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.server-name-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: 0 0 10px currentColor; /* Glow effect */
}

.server-name {
    font-weight: 600;
}

.server-uptime {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-left: 1.5rem; /* Align with text */
}

.status-text {
    font-weight: 700;
    font-size: 0.9rem;
}

/* Tickets Table */
.tickets-table {
    width: 100%;
    border-collapse: collapse;
}

.tickets-table th, .tickets-table td {
    padding: 1rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.tickets-table th {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-weight: 600;
}

.ticket-id {
    color: var(--color-primary);
    font-family: monospace;
}

.ticket-subject {
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.ticket-client {
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.priority-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    background-color: #333;
}

.priority-badge.alta {
    background-color: rgba(255, 68, 68, 0.2);
    color: #ff4444;
}

.priority-badge.media {
    background-color: rgba(255, 165, 0, 0.2);
    color: #ffa500;
}

.priority-badge.baja {
    background-color: rgba(227, 255, 4, 0.2);
    color: var(--color-primary);
}
</style>
