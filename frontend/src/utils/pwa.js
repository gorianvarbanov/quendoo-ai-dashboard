/**
 * PWA utilities for registering service worker and handling install prompt
 */

let deferredPrompt = null

/**
 * Register service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    })

    console.log('[PWA] Service Worker registered successfully:', registration.scope)

    // Check for updates periodically
    setInterval(() => {
      registration.update()
    }, 60 * 60 * 1000) // Check every hour

    return registration
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
    return null
  }
}

/**
 * Setup install prompt handler
 */
export function setupInstallPrompt() {
  // Capture the install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available')

    // Prevent the mini-infobar from appearing
    e.preventDefault()

    // Save the event for later use
    deferredPrompt = e

    // Dispatch custom event so app can show install button
    window.dispatchEvent(new CustomEvent('pwa-install-available'))
  })

  // Track when app is installed
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully')
    deferredPrompt = null

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('pwa-installed'))
  })
}

/**
 * Prompt user to install the app
 */
export async function promptInstall() {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available')
    return false
  }

  // Show the install prompt
  deferredPrompt.prompt()

  // Wait for user response
  const { outcome } = await deferredPrompt.userChoice
  console.log('[PWA] Install prompt outcome:', outcome)

  // Clear the deferred prompt
  deferredPrompt = null

  return outcome === 'accepted'
}

/**
 * Check if app is installed
 */
export function isAppInstalled() {
  // Check if running in standalone mode
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

/**
 * Check if install prompt is available
 */
export function isInstallPromptAvailable() {
  return deferredPrompt !== null
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Show notification
 */
export function showNotification(title, options = {}) {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.log('[PWA] Notification permission not granted')
    return null
  }

  const defaultOptions = {
    icon: '/quendoo-logo.svg',
    badge: '/quendoo-logo.svg',
    vibrate: [200, 100, 200],
    ...options
  }

  return new Notification(title, defaultOptions)
}
