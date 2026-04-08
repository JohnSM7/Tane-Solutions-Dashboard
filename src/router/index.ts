import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import CommercialView from '../views/CommercialView.vue';
import FinancialView from '../views/FinancialView.vue';
import OperationsView from '../views/OperationsView.vue';
import SupportView from '../views/SupportView.vue';
import AdminClientsView from '../views/AdminClientsView.vue';
import AdminClientProfileView from '../views/AdminClientProfileView.vue';
import ClientPortalView from '../views/ClientPortalView.vue';
import LoginView from '../views/LoginView.vue';
import UpdatePasswordView from '../views/UpdatePasswordView.vue';
import AlertasView from '../views/AlertasView.vue';
import AdminUsuariosView from '../views/AdminUsuariosView.vue';
import { authStore } from '../store/auth';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            component: LoginView,
            meta: { requiresGuest: true }
        },
        {
            path: '/update-password',
            name: 'updatePassword',
            component: UpdatePasswordView,
            meta: { requiresAuth: false }
        },
        {
            path: '/',
            redirect: () => {
                if (!authStore.isAuthenticated) return '/login';
                return authStore.role === 'CLIENT' ? '/client-panel' : '/dashboard';
            }
        },
        // --- ADMIN ROUTES ---
        {
            path: '/dashboard',
            name: 'dashboard',
            component: HomeView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/alerts',
            name: 'alerts',
            component: AlertasView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/commercial',
            name: 'commercial',
            component: CommercialView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/financial',
            name: 'financial',
            component: FinancialView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/operations',
            name: 'operations',
            component: OperationsView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/support',
            name: 'support',
            component: SupportView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/clients',
            name: 'clients',
            component: AdminClientsView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/clients/:id',
            name: 'clientProfile',
            component: AdminClientProfileView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/usuarios',
            name: 'usuarios',
            component: AdminUsuariosView,
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        // --- CLIENT ROUTES ---
        {
            path: '/client-panel',
            name: 'clientPanel',
            component: ClientPortalView,
            meta: { requiresAuth: true, roles: ['CLIENT'] }
        }
    ]
});

// Navigation Guard
router.beforeEach((to, _from, next) => {
    const isAuthenticated = authStore.isAuthenticated;
    const userRole = authStore.role;

    // Check if route requires guest (Login)
    if (to.meta.requiresGuest && isAuthenticated) {
        // If we are in a recovery flow (hash contains type=recovery), don't redirect yet
        if (window.location.hash.includes('type=recovery')) {
            return next();
        }
        return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
    }

    // Check if route requires authentication
    if (to.meta.requiresAuth && !isAuthenticated) {
        return next('/login');
    }

    // Check role access
    if (to.meta.roles && Array.isArray(to.meta.roles)) {
        if (!to.meta.roles.includes(userRole)) {
            // Unauthorized access, redirect back to home logic
            return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
        }
    }

    next();
});

export default router;
