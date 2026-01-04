import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/chat'
    },
    {
      path: '/chat/:conversationId?',
      name: 'chat',
      component: () => import('../views/ChatView.vue')
    },
    // Admin routes
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/admin/AdminLogin.vue')
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('../views/admin/AdminDashboard.vue'),
      beforeEnter: async (to, from, next) => {
        const authStore = useAuthStore()
        const isAuthenticated = await authStore.verifyAuthentication()
        if (isAuthenticated) {
          next()
        } else {
          next('/admin/login')
        }
      }
    },
    {
      path: '/admin/settings',
      name: 'admin-settings',
      component: () => import('../views/admin/AdminSettings.vue'),
      beforeEnter: async (to, from, next) => {
        const authStore = useAuthStore()
        const isAuthenticated = await authStore.verifyAuthentication()
        if (isAuthenticated) {
          next()
        } else {
          next('/admin/login')
        }
      }
    },
    {
      path: '/admin/security',
      name: 'admin-security',
      component: () => import('../views/admin/AdminSecurity.vue'),
      beforeEnter: async (to, from, next) => {
        const authStore = useAuthStore()
        const isAuthenticated = await authStore.verifyAuthentication()
        if (isAuthenticated) {
          next()
        } else {
          next('/admin/login')
        }
      }
    },
    {
      path: '/admin/security-config',
      name: 'admin-security-config',
      component: () => import('../views/admin/AdminSecurityConfig.vue'),
      beforeEnter: async (to, from, next) => {
        const authStore = useAuthStore()
        const isAuthenticated = await authStore.verifyAuthentication()
        if (isAuthenticated) {
          next()
        } else {
          next('/admin/login')
        }
      }
    },
    {
      path: '/admin/analytics',
      name: 'admin-analytics',
      component: () => import('../views/admin/AdminAnalytics.vue'),
      beforeEnter: async (to, from, next) => {
        const authStore = useAuthStore()
        const isAuthenticated = await authStore.verifyAuthentication()
        if (isAuthenticated) {
          next()
        } else {
          next('/admin/login')
        }
      }
    }
  ]
})

export default router
