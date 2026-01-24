import { onMounted, onUnmounted } from 'vue'

/**
 * Keyboard shortcuts composable
 *
 * Usage:
 * useKeyboardShortcuts({
 *   'ctrl+n': () => console.log('New conversation'),
 *   'ctrl+k': () => console.log('Search'),
 *   'escape': () => console.log('Close dialog')
 * })
 *
 * Supported modifiers: ctrl (or cmd on Mac), shift, alt
 */
export function useKeyboardShortcuts(shortcuts = {}) {
  const handleKeydown = (event) => {
    const key = event.key.toLowerCase()
    const ctrl = event.ctrlKey || event.metaKey // Support Mac Cmd key
    const shift = event.shiftKey
    const alt = event.altKey

    // Don't trigger shortcuts when typing in input fields
    const target = event.target
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable

    // Build key combination string
    let combo = ''
    if (ctrl) combo += 'ctrl+'
    if (shift) combo += 'shift+'
    if (alt) combo += 'alt+'
    combo += key

    // Check if shortcut exists
    if (shortcuts[combo]) {
      // For Escape, always allow (even in inputs)
      // For other shortcuts, skip if we're in an input field
      if (key !== 'escape' && isInput) {
        return
      }

      // Prevent default browser behavior
      event.preventDefault()
      event.stopPropagation()

      // Execute shortcut handler
      shortcuts[combo](event)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return { handleKeydown }
}
