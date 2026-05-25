import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guest: true },
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/pages/LoginPage.vue'),
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('@/pages/ProjectListPage.vue'),
        },
        {
          path: 'projects/create',
          name: 'project-create',
          component: () => import('@/pages/ProjectCreatePage.vue'),
        },
        {
          path: 'projects/:id',
          name: 'project-detail',
          component: () => import('@/pages/ProjectDetailPage.vue'),
          props: true,
        },
        {
          path: 'projects/:id/edit',
          name: 'project-edit',
          component: () => import('@/pages/ProjectEditPage.vue'),
          props: true,
        },
        {
          path: 'access-logs',
          name: 'access-logs',
          component: () => import('@/pages/AccessLogPage.vue'),
        },
        {
          path: 'action-logs',
          name: 'action-logs',
          component: () => import('@/pages/ActionLogPage.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
    }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
