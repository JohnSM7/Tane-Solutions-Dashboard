import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from '../store/auth';
import { isClientDomain, loginRoute } from '../utils/domain';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        // ── Auth ──────────────────────────────────────────────────────────────
        {
            path: '/login',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/login-cliente',
            name: 'loginCliente',
            component: () => import('../views/LoginClienteView.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/update-password',
            name: 'updatePassword',
            component: () => import('../views/UpdatePasswordView.vue'),
            meta: { requiresAuth: false }
        },
        {
            path: '/',
            redirect: () => {
                if (!authStore.isAuthenticated) return loginRoute();
                return authStore.role === 'CLIENT' ? '/client-panel' : '/dashboard';
            }
        },
        // ── Admin routes ──────────────────────────────────────────────────────
        {
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('../views/HomeView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/alerts',
            name: 'alerts',
            component: () => import('../views/AlertasView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/commercial',
            name: 'commercial',
            component: () => import('../views/CommercialView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/financial',
            name: 'financial',
            component: () => import('../views/FinancialView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/operations',
            name: 'operations',
            component: () => import('../views/OperationsView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/support',
            name: 'support',
            component: () => import('../views/SupportView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/clients',
            name: 'clients',
            component: () => import('../views/AdminClientsView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/clients/:id',
            name: 'clientProfile',
            component: () => import('../views/AdminClientProfileView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/usuarios',
            name: 'usuarios',
            component: () => import('../views/AdminUsuariosView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        {
            path: '/tareas',
            name: 'tareas',
            component: () => import('../views/TareasView.vue'),
            meta: { requiresAuth: true, roles: ['ADMIN'] }
        },
        // ── Client routes ─────────────────────────────────────────────────────
        {
            path: '/client-panel',
            name: 'clientPanel',
            component: () => import('../views/ClientPortalView.vue'),
            meta: { requiresAuth: true, roles: ['CLIENT'] }
        }
    ]
});

router.beforeEach((to, _from, next) => {
    const isAuthenticated = authStore.isAuthenticated;
    const userRole        = authStore.role;
    const onClientDomain  = isClientDomain();

    if (to.name === 'updatePassword') return next();

    if (to.name === 'login' && onClientDomain) return next('/login-cliente');
    if (to.name === 'loginCliente' && !onClientDomain) return next('/login');

    if (to.meta.requiresGuest) {
        if (!isAuthenticated) return next();
        if (window.location.hash.includes('type=recovery')) return next();
        return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
    }

    if (to.meta.requiresAuth) {
        if (!isAuthenticated) return next(loginRoute());

        if (to.meta.roles && Array.isArray(to.meta.roles)) {
            if (!(to.meta.roles as string[]).includes(userRole ?? '')) {
                return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
            }
        }

        if (onClientDomain && userRole === 'ADMIN') {
            return next('/login-cliente?error=rol');
        }

        return next();
    }

    next();
});

export default router;
