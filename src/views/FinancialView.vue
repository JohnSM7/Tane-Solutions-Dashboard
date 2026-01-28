<script setup lang="ts">
import DashboardCard from '../components/DashboardCard.vue';


const kpis = [
  { label: 'Facturación Mensual', value: '$15,400', trend: '+8% vs mes anterior', color: '#e3ff04' },
  { label: 'MRR (Ingreso Recurrente)', value: '$8,200', trend: '+12% vs año anterior', color: '#e3ff04' },
  { label: 'Cuentas por Cobrar', value: '$3,200', trend: '2 facturas vencidas', color: '#ff4444' },
  { label: 'Beneficio Neto Estimado', value: '65%', trend: 'Estable', color: '#ffffff' },
];

const projects = [
  { name: 'E-commerce Tane', price: 12000, cost: 4500, margin: '62%' },
  { name: 'App Restaurante', price: 8000, cost: 6000, margin: '25%' },
  { name: 'Web Inmobiliaria', price: 3500, cost: 1200, margin: '65%' },
];
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo Financiero</h1>
      <span class="subtitle">La Salud del Negocio</span>
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
      <!-- Billing Chart Mockup -->
      <DashboardCard title="Facturación Mes a Mes">
        <div class="chart-container">
            <div class="bars">
                <div class="bar-group">
                    <div class="bar prev" style="height: 40%"></div>
                    <div class="bar current" style="height: 50%"></div>
                    <span class="bar-label">Nov</span>
                </div>
                <div class="bar-group">
                    <div class="bar prev" style="height: 50%"></div>
                    <div class="bar current" style="height: 65%"></div>
                    <span class="bar-label">Dic</span>
                </div>
                <div class="bar-group">
                    <div class="bar prev" style="height: 30%"></div>
                    <div class="bar current" style="height: 45%"></div>
                    <span class="bar-label">Ene</span>
                </div>
                <div class="bar-group">
                    <div class="bar prev" style="height: 60%"></div>
                    <div class="bar current" style="height: 80%"></div>
                    <span class="bar-label">Feb</span>
                </div>
            </div>
            <div class="legend">
                <span class="legend-item"><span class="dot prev"></span>Año Anterior</span>
                <span class="legend-item"><span class="dot current"></span>Año Actual</span>
            </div>
        </div>
      </DashboardCard>

      <!-- Project Profitability -->
      <DashboardCard title="Rentabilidad por Proyecto">
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Proyecto</th>
                        <th>Presupuesto</th>
                        <th>Coste</th>
                        <th>Margen</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="project in projects" :key="project.name">
                        <td>{{ project.name }}</td>
                        <td>${{ project.price }}</td>
                        <td>${{ project.cost }}</td>
                        <td>
                            <span class="badge" :class="{'high': parseInt(project.margin) > 50, 'low': parseInt(project.margin) < 30}">
                                {{ project.margin }}
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
/* Reusing some layout styles */
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

/* Chart Styles */
.chart-container {
    height: 250px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.bars {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    flex: 1;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
}

.bar-group {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    height: 100%;
}

.bar {
    width: 20px;
    border-radius: 4px 4px 0 0;
}

.bar.prev {
    background-color: #333;
}

.bar.current {
    background-color: var(--color-primary);
}

.bar-label {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.legend {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1.5rem;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.dot.prev { background-color: #333; }
.dot.current { background-color: var(--color-primary); }

/* Table Styles */
.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th, .data-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.data-table th {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-weight: 600;
}

.badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 700;
    font-size: 0.8rem;
    background-color: #333;
}

.badge.high {
    background-color: rgba(227, 255, 4, 0.2);
    color: var(--color-primary);
}

.badge.low {
    background-color: rgba(255, 68, 68, 0.2);
    color: #ff4444;
}
</style>
