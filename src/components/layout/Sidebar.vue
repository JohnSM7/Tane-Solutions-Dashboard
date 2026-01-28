<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

// Spanish labels and correct routes
const navItems = [
  { name: 'Comercial', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', link: '/commercial' },
  { name: 'Financiero', icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z', link: '/financial' },
  { name: 'Operaciones', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', link: '/operations' },
  { name: 'Soporte', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z', link: '/support' },
];

const expanded = ref(false); // Mobile toggle state

const toggleSidebar = () => {
    expanded.value = !expanded.value;
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
            <div class="logo"><img class="logo-img" src="/public/logo.png" alt="Logo"></div>
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
            </RouterLink>
        </nav>

        <div class="user-profile">
        <div class="avatar">JS</div>
        <div class="user-info">
            <span class="name">John Sandoval</span>
            <span class="role">Admin</span>
        </div>
        </div>
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
  background-color: var(--color-primary);
  color: var(--color-bg-dark);
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px; /* Square with slight radius */
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
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border);
}

.avatar {
  width: 40px;
  height: 40px;
  background-color: #333;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
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
</style>
