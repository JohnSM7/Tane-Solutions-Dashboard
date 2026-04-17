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
import LoginClienteView from '../views/LoginClienteView.vue';
import UpdatePasswordView from '../views/UpdatePasswordView.vue';
import AlertasView from '../views/AlertasView.vue';
import AdminUsuariosView from '../views/AdminUsuariosView.vue';
import { authStore } from '../store/auth';
import { isClientDomain, loginRoute } from '../utils/domain';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        // ── Auth ──────────────────────────────────────────────────────────────
        {
            path: '/login',
            name: 'login',
            component: LoginView,
            meta: { requiresGuest: true }
        },
        {
            path: '/login-cliente',
            name: 'loginCliente',
            component: LoginClienteView,
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
                if (!authStore.isAuthenticated) return loginRoute();
                return authStore.role === 'CLIENT' ? '/client-panel' : '/dashboard';
            }
        },
        // ── Admin routes ──────────────────────────────────────────────────────
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
        // ── Client routes ─────────────────────────────────────────────────────
        {
            path: '/client-panel',
            name: 'clientPanel',
            component: ClientPortalView,
            meta: { requiresAuth: true, roles: ['CLIENT'] }
        }
    ]
});

router.beforeEach((to, _from, next) => {
    const isAuthenticated = authStore.isAuthenticated;
    const userRole        = authStore.role;
    const onClientDomain  = isClientDomain();

    // Always allow password recovery
    if (to.name === 'updatePassword') return next();

    // Redirect bare /login to /login-cliente on client domain (and vice-versa)
    if (to.name === 'login' && onClientDomain) return next('/login-cliente');
    if (to.name === 'loginCliente' && !onClientDomain) return next('/login');

    // Guest-only routes (login pages)
    if (to.meta.requiresGuest) {
        if (!isAuthenticated) return next();
        // Recovery flow: let through
        if (window.location.hash.includes('type=recovery')) return next();
        return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
    }

    // Protected routes
    if (to.meta.requiresAuth) {
        if (!isAuthenticated) return next(loginRoute());

        // Role-based access
        if (to.meta.roles && Array.isArray(to.meta.roles)) {
            if (!(to.meta.roles as string[]).includes(userRole ?? '')) {
                return next(userRole === 'CLIENT' ? '/client-panel' : '/dashboard');
            }
        }

        // Domain enforcement: block ADMINs from client domain
        if (onClientDomain && userRole === 'ADMIN') {
            return next('/login-cliente?error=rol');
        }

        return next();
    }

    next();
});

export default router;
