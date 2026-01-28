<script setup lang="ts">
import DashboardCard from '../components/DashboardCard.vue';


const kpis = [
  { label: 'Leads Nuevos (Semana)', value: '18', trend: '+12%', color: '#e3ff04' },
  { label: 'Tasa de Conversión', value: '35%', trend: '+5%', color: '#e3ff04' },
  { label: 'Valor Promedio', value: '$2,500', trend: '', color: '#ffffff' },
  { label: 'CAC', value: '$150', trend: '-2%', color: '#e3ff04' },
];

const topServices = [
  { name: 'Pack Starter', sales: 12, value: '45%' },
  { name: 'Desarrollo a Medida', sales: 5, value: '30%' },
  { name: 'Mantenimiento Premium', sales: 8, value: '25%' },
];
</script>

<template>
  <div class="view-container">
    <div class="header">
      <h1>Módulo Comercial</h1>
      <span class="subtitle">El Motor de Ventas</span>
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
      <!-- Funnel Chart Mockup -->
      <DashboardCard title="Embudo de Ventas (Pipeline)">
        <div class="funnel-container">
          <div class="funnel-step" style="width: 100%; opacity: 0.2">Leads (45)</div>
          <div class="funnel-step" style="width: 80%; opacity: 0.4">Cualificados (30)</div>
          <div class="funnel-step" style="width: 60%; opacity: 0.6">Propuestas (25)</div>
          <div class="funnel-step" style="width: 40%; opacity: 0.8">Negociación (10)</div>
          <div class="funnel-step highlight" style="width: 30%;">Cerrados (8)</div>
        </div>
      </DashboardCard>

      <!-- Top Services -->
      <DashboardCard title="Top Servicios Vendidos">
        <ul class="services-list">
          <li v-for="service in topServices" :key="service.name" class="service-item">
            <div class="service-info">
              <span class="service-name">{{ service.name }}</span>
              <span class="service-sales">{{ service.sales }} ventas</span>
            </div>
            <div class="progress-bar">
              <div class="fill" :style="{ width: service.value }"></div>
            </div>
          </li>
        </ul>
      </DashboardCard>
    </div>
    
  </div>
</template>

<style scoped>
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
    font-size: 0.9rem;
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

/* Funnel Styles */
.funnel-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0;
}

.funnel-step {
    background-color: var(--color-primary);
    color: var(--color-bg-dark);
    text-align: center;
    padding: 0.8rem;
    font-weight: 700;
    border-radius: 4px;
    white-space: nowrap; /* Prevent wrapping */
    min-width: fit-content; /* Ensure bar is at least as wide as text */
    overflow: visible; /* Allow text to be seen if it somehow still overflows (though fit-content should fix) */
}

.funnel-step.highlight {
    background-color: #fff;
    color: #000;
}

/* Service List Styles */
.services-list {
    list-style: none;
    padding: 0;
}

.service-item {
    margin-bottom: 1.5rem;
}

.service-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.progress-bar {
    width: 100%;
    height: 6px;
    background-color: var(--color-bg-lighter);
    border-radius: 3px;
    overflow: hidden;
}

.fill {
    height: 100%;
    background-color: var(--color-primary);
}
</style>
