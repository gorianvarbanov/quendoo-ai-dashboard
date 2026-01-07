/**
 * Axios Configuration & Interceptors
 * Handles automatic token refresh and API error handling
 */

import axios from 'axios'
import router from '@/router'

// Base URL configuration
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'

// Create axios instance
const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const hotelToken = localStorage.getItem('hotelToken')
    if (hotelToken) {
      config.headers.Authorization = `Bearer ${hotelToken}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Handle token refresh
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Check if we have a token to refresh
      const hotelToken = localStorage.getItem('hotelToken')
      if (!hotelToken) {
        // No token - redirect to login
        localStorage.clear()
        router.push('/login')
        return Promise.reject(error)
      }

      try {
        // Attempt to refresh token
        console.log('[Axios] Attempting token refresh...')

        const { data } = await axios.post(
          `${baseURL}/api/hotels/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${hotelToken}`
            }
          }
        )

        if (data.success && data.hotelToken) {
          // Update stored token
          localStorage.setItem('hotelToken', data.hotelToken)

          // Update Authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${data.hotelToken}`

          console.log('[Axios] Token refreshed successfully')

          // Retry the original request with new token
          return api(originalRequest)
        }
      } catch (refreshError) {
        console.error('[Axios] Token refresh failed:', refreshError)

        // Refresh failed - clear storage and redirect to login
        localStorage.clear()
        router.push('/login')
        return Promise.reject(refreshError)
      }
    }

    // Handle account locked (423)
    if (error.response?.status === 423) {
      console.warn('[Axios] Account locked:', error.response.data)
    }

    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      console.warn('[Axios] Rate limit exceeded:', error.response.data)
    }

    return Promise.reject(error)
  }
)

export default api
