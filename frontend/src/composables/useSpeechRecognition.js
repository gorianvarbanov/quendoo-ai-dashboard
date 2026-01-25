import { ref, computed, onUnmounted } from 'vue'

/**
 * Speech recognition composable using Web Speech API
 */
export function useSpeechRecognition(options = {}) {
  const {
    lang = 'bg-BG', // Default to Bulgarian
    continuous = true,
    interimResults = true
  } = options

  // Check browser support
  const isSupported = computed(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  })

  // State
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref(null)
  const recognition = ref(null)

  // Initialize recognition
  const initRecognition = () => {
    if (!isSupported.value) {
      error.value = 'Speech recognition is not supported in this browser'
      return null
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognitionInstance = new SpeechRecognition()

    recognitionInstance.lang = lang
    recognitionInstance.continuous = continuous
    recognitionInstance.interimResults = interimResults
    recognitionInstance.maxAlternatives = 1

    // Event handlers
    recognitionInstance.onstart = () => {
      console.log('[SpeechRecognition] Started listening')
      isListening.value = true
      error.value = null
    }

    recognitionInstance.onend = () => {
      console.log('[SpeechRecognition] Stopped listening')
      isListening.value = false
    }

    recognitionInstance.onresult = (event) => {
      let interimText = ''
      let finalText = ''

      // Process ALL results to get the full transcript
      for (let i = 0; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript

        if (event.results[i].isFinal) {
          finalText += transcriptPart + ' '
        } else {
          interimText += transcriptPart
        }
      }

      // Set full final transcript (not append)
      if (finalText) {
        transcript.value = finalText.trim()
        console.log('[SpeechRecognition] Final transcript:', transcript.value)
      }

      interimTranscript.value = interimText
      console.log('[SpeechRecognition] Interim transcript:', interimText)
    }

    recognitionInstance.onerror = (event) => {
      console.error('[SpeechRecognition] Error:', event.error)

      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
          error.value = 'No speech detected. Please try again.'
          break
        case 'audio-capture':
          error.value = 'No microphone found. Please ensure your microphone is connected.'
          break
        case 'not-allowed':
          error.value = 'Microphone access denied. Please allow microphone access.'
          break
        case 'network':
          error.value = 'Network error occurred. Please check your connection.'
          break
        default:
          error.value = `Speech recognition error: ${event.error}`
      }

      isListening.value = false
    }

    return recognitionInstance
  }

  // Start listening
  const start = () => {
    if (!isSupported.value) {
      error.value = 'Speech recognition is not supported in this browser'
      return
    }

    if (isListening.value) {
      console.log('[SpeechRecognition] Already listening')
      return
    }

    try {
      if (!recognition.value) {
        recognition.value = initRecognition()
      }

      // Reset transcripts
      transcript.value = ''
      interimTranscript.value = ''
      error.value = null

      recognition.value.start()
    } catch (err) {
      console.error('[SpeechRecognition] Failed to start:', err)
      error.value = 'Failed to start speech recognition'
    }
  }

  // Stop listening
  const stop = () => {
    if (recognition.value && isListening.value) {
      try {
        recognition.value.stop()
      } catch (err) {
        console.error('[SpeechRecognition] Failed to stop:', err)
      }
    }
  }

  // Toggle listening
  const toggle = () => {
    if (isListening.value) {
      stop()
    } else {
      start()
    }
  }

  // Reset transcripts
  const reset = () => {
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  // Get full transcript (final + interim)
  const fullTranscript = computed(() => {
    return transcript.value + interimTranscript.value
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (recognition.value) {
      recognition.value.abort()
      recognition.value = null
    }
  })

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    error,
    start,
    stop,
    toggle,
    reset
  }
}
