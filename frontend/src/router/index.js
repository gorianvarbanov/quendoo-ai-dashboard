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
      component: () => import('../views/ChatView.vue'),
      beforeEnter: (to, from, next) => {
        const hotelToken = localStorage.getItem('hotelToken')
        if (!hotelToken) {
          // No hotel token - redirect to login
          next('/login')
        } else {
          next()
        }
      }
    },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('../views/DocumentsView.vue'),
      beforeEnter: (to, from, next) => {
        const hotelToken = localStorage.getItem('hotelToken')
        if (!hotelToken) {
          // No hotel token - redirect to login
          next('/login')
        } else {
          next()
        }
      }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/TasksView.vue'),
      beforeEnter: (to, from, next) => {
        const hotelToken = localStorage.getItem('hotelToken')
        if (!hotelToken) {
          // No hotel token - redirect to login
          next('/login')
        } else {
          next()
        }
      }
    },
    // Hotel authentication
    {
      path: '/login',
      name: 'hotel-login',
      component: () => import('../views/HotelLoginView.vue')
    },
    {
      path: '/register',
      name: 'hotel-registration',
      component: () => import('../views/HotelRegistrationView.vue')
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
      path: '/admin/hotels',
      name: 'admin-hotels',
      component: () => import('../views/admin/AdminHotels.vue'),
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
    },
    {
      path: '/admin/integration',
      name: 'admin-integration',
      component: () => import('../views/admin/AdminIntegration.vue'),
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
      path: '/admin/conversations',
      name: 'admin-conversations',
      component: () => import('../views/admin/AdminConversations.vue'),
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
      path: '/admin/currency',
      name: 'admin-currency',
      component: () => import('../views/admin/AdminCurrency.vue'),
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
