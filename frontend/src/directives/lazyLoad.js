/**
 * Lazy loading directive for images
 * Usage: <img v-lazy-load="imageSrc" alt="description">
 */

export const lazyLoad = {
  mounted(el, binding) {
    const loadImage = () => {
      const imageUrl = binding.value

      if (!imageUrl) return

      // Create a temporary image to load
      const img = new Image()

      img.onload = () => {
        el.src = imageUrl
        el.classList.add('lazy-loaded')
        el.classList.remove('lazy-loading')
      }

      img.onerror = () => {
        el.classList.add('lazy-error')
        el.classList.remove('lazy-loading')
        console.error('[LazyLoad] Failed to load image:', imageUrl)
      }

      // Start loading
      el.classList.add('lazy-loading')
      img.src = imageUrl
    }

    // Use Intersection Observer for better performance
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage()
          observer.unobserve(el)
        }
      })
    }, {
      rootMargin: '50px', // Start loading 50px before element enters viewport
      threshold: 0.01
    })

    observer.observe(el)

    // Store observer to cleanup later
    el._lazyLoadObserver = observer
  },

  unmounted(el) {
    // Cleanup observer
    if (el._lazyLoadObserver) {
      el._lazyLoadObserver.disconnect()
      delete el._lazyLoadObserver
    }
  }
}

// Register globally in main.js:
// app.directive('lazy-load', lazyLoad)
