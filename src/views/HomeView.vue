<script setup lang="ts">
import DashboardCard from '../components/DashboardCard.vue';

const stats = [
  { label: 'Total Users', value: '12,345', trend: '+12%', color: '#e3ff04' },
  { label: 'Revenue', value: '$45.2k', trend: '+8%', color: '#e3ff04' },
  { label: 'Active Projects', value: '24', trend: '-2%', color: '#ff4444' },
  { label: 'System Status', value: '98%', trend: 'Stable', color: '#e3ff04' },
];
</script>

<template>
  <div class="home-view">
    <div class="header">
      <h1>Dashboard Overview</h1>
      <button class="cta-button">Download Report</button>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <DashboardCard v-for="stat in stats" :key="stat.label">
        <div class="stat-item">
          <span class="stat-label">{{ stat.label }}</span>
          <div class="stat-value-row">
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-trend" :style="{ color: stat.color }">{{ stat.trend }}</span>
          </div>
        </div>
      </DashboardCard>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <DashboardCard title="Recent Activity" class="activity-card">
        <ul class="activity-list">
          <li v-for="i in 5" :key="i" class="activity-item">
            <div class="dot"></div>
            <div class="details">
              <span class="action">New user registration</span>
              <span class="time">{{ i * 15 }} minutes ago</span>
            </div>
          </li>
        </ul>
      </DashboardCard>

      <DashboardCard title="Server Performance" class="chart-card">
        <div class="placeholder-chart">
            <!-- Simulated Chart Visual -->
            <div class="bar" style="height: 40%"></div>
            <div class="bar" style="height: 60%"></div>
            <div class="bar" style="height: 30%"></div>
            <div class="bar" style="height: 80%; background-color: var(--color-primary)"></div>
            <div class="bar" style="height: 50%"></div>
            <div class="bar" style="height: 70%"></div>
        </div>
      </DashboardCard>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cta-button {
  background-color: var(--color-primary);
  color: var(--color-bg-dark);
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  border-radius: 4px;
  transition: transform 0.2s;
  text-transform: uppercase;
  font-size: 0.9rem;
}

.cta-button:hover {
  transform: translateY(-2px);
  background-color: var(--color-primary-hover);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-label {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.stat-value-row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.stat-trend {
  font-size: 0.9rem;
  font-weight: 600;
  padding-bottom: 4px;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 1000px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.activity-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.activity-item:last-child {
  border-bottom: none;
}

.dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--color-primary);
}

.details {
  display: flex;
  flex-direction: column;
}

.action {
  font-weight: 500;
}

.time {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.placeholder-chart {
    height: 200px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    padding-top: 20px;
}

.bar {
    flex: 1;
    background-color: #333;
    border-radius: 4px 4px 0 0;
    transition: height 0.5s ease;
}
</style>
