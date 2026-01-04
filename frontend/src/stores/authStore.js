import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
const TOKEN_KEY = 'quendoo-admin-token'

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref(null)
  const user = ref(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref(null)

  // Load token from localStorage on init
  const loadToken = () => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (storedToken) {
        token.value = storedToken
        // Verify token is still valid
        verifyAuthentication()
      }
    } catch (err) {
      console.error('[Auth Store] Failed to load token:', err)
    }
  }

  // Save token to localStorage
  const saveToken = (newToken) => {
    try {
      localStorage.setItem(TOKEN_KEY, newToken)
      token.value = newToken
    } catch (err) {
      console.error('[Auth Store] Failed to save token:', err)
    }
  }

  // Clear token from localStorage
  const clearToken = () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
      token.value = null
      user.value = null
      isAuthenticated.value = false
    } catch (err) {
      console.error('[Auth Store] Failed to clear token:', err)
    }
  }

  // Login
  const login = async (username, password) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        username,
        password
      })

      if (response.data.success) {
        saveToken(response.data.token)
        user.value = response.data.user
        isAuthenticated.value = true

        console.log('[Auth Store] Login successful:', response.data.user.username)
        return { success: true }
      } else {
        error.value = response.data.error || 'Login failed'
        return { success: false, error: error.value }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Login failed'
      error.value = errorMessage
      console.error('[Auth Store] Login error:', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  // Logout
  const logout = () => {
    clearToken()
    console.log('[Auth Store] Logged out')
  }

  // Verify authentication status
  const verifyAuthentication = async () => {
    if (!token.value) {
      isAuthenticated.value = false
      return false
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/admin/verify`, {
        headers: {
          Authorization: `Bearer ${token.value}`
        }
      })

      if (response.data.authenticated) {
        user.value = response.data.user
        isAuthenticated.value = true
        return true
      } else {
        clearToken()
        return false
      }
    } catch (err) {
      console.error('[Auth Store] Token verification failed:', err.message)
      clearToken()
      return false
    }
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  // Computed: Check if admin role
  const isAdmin = computed(() => {
    return isAuthenticated.value && user.value?.role === 'admin'
  })

  // Initialize on creation
  loadToken()

  return {
    // State
    token,
    user,
    isAuthenticated,
    isLoading,
    error,
    isAdmin,

    // Actions
    login,
    logout,
    verifyAuthentication,
    clearError
  }
})
