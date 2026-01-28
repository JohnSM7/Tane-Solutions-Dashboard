import { createRouter, createWebHistory } from 'vue-router';
import CommercialView from '../views/CommercialView.vue';
import FinancialView from '../views/FinancialView.vue';
import OperationsView from '../views/OperationsView.vue';
import SupportView from '../views/SupportView.vue';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/commercial'
        },
        {
            path: '/commercial',
            name: 'commercial',
            component: CommercialView
        },
        {
            path: '/financial',
            name: 'financial',
            component: FinancialView
        },
        {
            path: '/operations',
            name: 'operations',
            component: OperationsView
        },
        {
            path: '/support',
            name: 'support',
            component: SupportView
        }
    ]
});

export default router;
