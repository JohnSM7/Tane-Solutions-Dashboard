<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { authStore, logout } from '../../store/auth';
import { fetchAlertasCount } from '../../services/alerts';
import { notifStore, initRealtime, marcarTodasLeidas } from '../../store/notifications';

const router = useRouter();

const alertasCount = ref(0);

const showNotifPanel = ref(false);

onMounted(async () => {
  if (authStore.role === 'ADMIN') {
    alertasCount.value = await fetchAlertasCount().catch(() => 0);
    initRealtime();
  }
});

// Admin Routes
const adminItems = [
  { name: 'Inicio', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', link: '/dashboard' },
  { name: 'Alertas', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', link: '/alerts' },
  { name: 'Comercial', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', link: '/commercial' },
  { name: 'Financiero', icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z', link: '/financial' },
  { name: 'Operaciones', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', link: '/operations' },
  { name: 'Soporte', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z', link: '/support' },
  { name: 'Clientes (Admin)', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', link: '/clients' },
  { name: 'Usuarios', icon: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z', link: '/usuarios' },
  { name: 'Tareas', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z', link: '/tareas' },
  { name: 'Calendario', icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z', link: '/calendario' },
  { name: 'Contratos', icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8z', link: '/contratos' }
];

// Client Routes
const clientItems = [
  { name: 'Panel Cliente', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', link: '/client-panel' }
];

const navItems = computed(() => {
    return authStore.role === 'ADMIN' ? adminItems : clientItems;
});

const expanded = ref(false); // Mobile toggle state

const toggleSidebar = () => {
    expanded.value = !expanded.value;
};

const handleLogout = async () => {
    await logout();
    router.push('/login');
};
</script>

<template>
  <div>
    <!-- Mobile Toggle -->
    <button v-if="!expanded" class="mobile-toggle" @click="toggleSidebar">
        ☰
    </button>
    
    <aside class="sidebar" :class="{ 'expanded': expanded }">
        <div class="brand">
            <div class="logo"><img class="logo-img" src="/logo-verde.png" alt="Logo"></div>
            <span class="brand-name">TANE SOLUTIONS</span>
            <button class="close-sidebar" @click="toggleSidebar">×</button>
        </div>
        
        <nav class="nav">
            <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="item.link"
            class="nav-item"
            active-class="active"
            @click="expanded = false"
            >
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                <path :d="item.icon" />
            </svg>
            <span class="label">{{ item.name }}</span>
            <span v-if="item.link === '/alerts' && alertasCount > 0" class="alert-badge">
                {{ alertasCount > 9 ? '9+' : alertasCount }}
            </span>
            </RouterLink>
        </nav>

        <div class="user-profile">
            <div class="user-info-container">
                <div class="avatar">{{ authStore.user?.name.charAt(0) || 'U' }}</div>
                <div class="user-info">
                    <span class="name">{{ authStore.user?.name || 'Usuario' }}</span>
                    <span class="role">{{ authStore.role === 'ADMIN' ? 'Agencia' : 'Cliente Titular' }}</span>
                </div>
            </div>
            <div class="notif-logout">
                <button class="notif-btn" @click="showNotifPanel = !showNotifPanel" title="Notificaciones" v-if="authStore.role === 'ADMIN'">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                    </svg>
                    <span v-if="notifStore.unread > 0" class="notif-badge">
                        {{ notifStore.unread > 9 ? '9+' : notifStore.unread }}
                    </span>
                </button>
                <button class="logout-btn" @click="handleLogout" title="Cerrar Sesión">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Panel de notificaciones -->
        <Transition name="slide-up">
        <div v-if="showNotifPanel" class="notif-panel">
            <div class="notif-panel-header">
                <span>Notificaciones</span>
                <button class="notif-clear" @click="marcarTodasLeidas">Marcar leídas</button>
            </div>
            <div v-if="notifStore.items.length === 0" class="notif-empty">Sin notificaciones</div>
            <div v-else class="notif-list">
                <div v-for="n in notifStore.items" :key="n.id"
                    class="notif-item" :class="{ unread: !n.leida }">
                    <span class="notif-icon">{{ n.tipo === 'ticket' ? '🎫' : '🚨' }}</span>
                    <div class="notif-body">
                        <span class="notif-title">{{ n.titulo }}</span>
                        <span class="notif-sub">{{ n.subtitulo }}</span>
                    </div>
                </div>
            </div>
        </div>
        </Transition>
    </aside>
    
    <!-- Mobile overlay -->
    <div v-if="expanded" class="overlay" @click="expanded = false"></div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 280px;
  height: 100vh;
  background-color: var(--color-bg-card);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 2rem;
  flex-shrink: 0;
  transition: transform 0.3s ease;
  z-index: 100;
}

/* Mobile responsive styles */
.mobile-toggle {
    display: none;
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 200;
    color: var(--color-primary);
    background: var(--color-bg-card);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 1.5rem;
}

.overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.5);
    z-index: 90;
    backdrop-filter: blur(2px);
}

@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        transform: translateX(-100%);
    }

    .sidebar.expanded {
        transform: translateX(0);
    }
    
    .mobile-toggle {
        display: block;
    }

    .overlay {
        display: block;
    }
}

.brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 3rem;
}

.logo {
  width: 40px;
  height: 40px;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.logo-img {
  width: 35px;
  height: 35px;
}

.close-sidebar {
    display: none;
    font-size: 2rem;
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    margin-left: auto; /* Push to right */
    line-height: 1;
}

@media (max-width: 768px) {
    .close-sidebar {
        display: block;
    }
}

.brand-name {
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  color: var(--color-text-muted);
  font-weight: 500;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--color-text-light);
}

.nav-item.active {
  background-color: rgba(227, 255, 4, 0.1);
  color: var(--color-primary);
  border-left: 3px solid var(--color-primary); /* Subtle active indicator */
}

.icon {
  width: 24px;
  height: 24px;
}

.user-profile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border);
}

.user-info-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar {
  width: 40px;
  height: 40px;
  background-color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  color: #000;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 700;
  font-size: 0.9rem;
}

.role {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.logout-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.logout-btn:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
}

.notif-logout { display: flex; align-items: center; gap: 4px; }

.notif-btn {
    position: relative;
    background: none; border: none;
    color: var(--color-text-muted); cursor: pointer;
    padding: 0.5rem; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.3s;
}
.notif-btn:hover { color: var(--color-primary); background: rgba(227,255,4,0.1); }
.notif-badge {
    position: absolute; top: 2px; right: 2px;
    background: #ff4444; color: #fff;
    font-size: 0.6rem; font-weight: 700;
    min-width: 15px; height: 15px;
    border-radius: 8px; display: flex;
    align-items: center; justify-content: center;
    padding: 0 3px;
}

.notif-panel {
    position: absolute;
    bottom: 80px;
    left: 1rem;
    right: 1rem;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    z-index: 200;
    overflow: hidden;
    max-height: 320px;
    display: flex;
    flex-direction: column;
}
.notif-panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    font-weight: 700; font-size: 0.85rem;
}
.notif-clear { background: none; border: none; color: var(--color-primary); font-size: 0.75rem; cursor: pointer; }
.notif-empty { padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem; }
.notif-list  { overflow-y: auto; }
.notif-item  {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.15s;
}
.notif-item:last-child { border-bottom: none; }
.notif-item.unread { background: rgba(227,255,4,0.04); }
.notif-icon  { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
.notif-body  { display: flex; flex-direction: column; gap: 2px; }
.notif-title { font-size: 0.82rem; font-weight: 600; }
.notif-sub   { font-size: 0.75rem; color: var(--color-text-muted); }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }

.alert-badge {
    margin-left: auto;
    background: #ff4444;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
}
</style>
