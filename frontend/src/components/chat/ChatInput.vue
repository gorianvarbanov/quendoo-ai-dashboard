<template>
  <div class="chat-input-container">
    <!-- Draft indicator -->
    <transition name="fade">
      <div v-if="hasDraft && draftSavedAt" class="draft-indicator">
        <v-icon size="12" class="mr-1">mdi-content-save</v-icon>
        <span class="draft-text">Draft saved</span>
      </div>
    </transition>

    <!-- Voice recording indicator -->
    <transition name="fade">
      <div v-if="isListening" class="voice-indicator">
        <div class="voice-pulse"></div>
        <v-icon size="16" class="mr-2" color="error">mdi-microphone</v-icon>
        <span class="voice-text">Listening...</span>
        <span v-if="interimTranscript" class="interim-text">{{ interimTranscript }}</span>
      </div>
    </transition>

    <!-- Voice error alert -->
    <transition name="fade">
      <v-alert
        v-if="voiceError"
        type="error"
        variant="tonal"
        density="compact"
        closable
        class="voice-error"
        @click:close="voiceError = null"
      >
        {{ voiceError }}
      </v-alert>
    </transition>

    <div class="input-wrapper">
      <!-- File attachments preview -->
      <transition-group name="fade-list" tag="div" class="attachments-preview" v-if="attachments.length > 0">
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="attachment-item"
        >
          <!-- Image preview -->
          <img
            v-if="attachment.preview"
            :src="attachment.preview"
            :alt="attachment.name"
            class="attachment-image"
          />
          <!-- File icon -->
          <v-icon v-else size="32" :icon="getFileIcon(attachment.type)" class="attachment-icon" />

          <!-- File info -->
          <div class="attachment-info">
            <div class="attachment-name">{{ attachment.name }}</div>
            <div class="attachment-size">{{ formatFileSize(attachment.size) }}</div>
          </div>

          <!-- Remove button -->
          <v-btn
            icon
            variant="text"
            size="x-small"
            @click="removeAttachment(attachment.id)"
            class="attachment-remove"
          >
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </div>
      </transition-group>

      <v-textarea
        v-model="inputMessage"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="2"
        auto-grow
        max-rows="10"
        variant="outlined"
        hide-details
        @keydown.enter.exact.prevent="handleEnter"
        @keydown.enter.shift.exact="handleShiftEnter"
        class="message-input"
        density="comfortable"
      >
        <template v-slot:prepend-inner>
          <!-- File attachment button -->
          <v-btn
            icon
            @click="openFilePicker"
            size="small"
            variant="text"
            class="mr-1"
            title="Attach files"
          >
            <v-icon size="20">mdi-paperclip</v-icon>
          </v-btn>

          <!-- Hidden file input -->
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="acceptedTypes.join(',')"
            @change="handleFileSelect"
            style="display: none;"
          />
        </template>

        <template v-slot:append-inner>
          <!-- Voice input button -->
          <v-btn
            v-if="voiceSupported"
            icon
            @click="handleVoiceToggle"
            size="small"
            :color="isListening ? 'error' : 'default'"
            :variant="isListening ? 'flat' : 'text'"
            class="mr-1"
            :title="isListening ? 'Stop recording' : 'Start voice input'"
          >
            <v-icon size="20" :class="{ 'mic-pulse': isListening }">
              {{ isListening ? 'mdi-microphone' : 'mdi-microphone-outline' }}
            </v-icon>
          </v-btn>

          <!-- Send button -->
          <v-btn
            icon
            :disabled="!canSend"
            :loading="loading"
            color="primary"
            @click="handleSend"
            size="small"
            variant="flat"
          >
            <v-icon size="20">mdi-send</v-icon>
          </v-btn>
        </template>
      </v-textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDrafts } from '@/composables/useDrafts'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'
import { useFileAttachments } from '@/composables/useFileAttachments'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Type your message...'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  conversationId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['send'])

const inputMessage = ref('')

// Draft management
const {
  draft,
  hasDraft,
  draftSavedAt,
  loadDraft,
  clearDraft,
  autosaveDraft
} = useDrafts(computed(() => props.conversationId))

// Load draft when component mounts or conversation changes
watch(() => props.conversationId, (newId) => {
  if (newId) {
    const loadedDraft = loadDraft()
    if (loadedDraft) {
      inputMessage.value = loadedDraft
    }
  }
}, { immediate: true })

// Auto-save draft when input changes
watch(inputMessage, (newValue) => {
  if (newValue && newValue.trim().length > 0) {
    autosaveDraft(newValue)
  } else {
    clearDraft()
  }
})

// Voice input with speech recognition
const {
  isSupported: voiceSupported,
  isListening,
  transcript: voiceTranscript,
  interimTranscript,
  error: voiceError,
  start: startVoice,
  stop: stopVoice,
  toggle: toggleVoice,
  reset: resetVoice
} = useSpeechRecognition({ lang: 'bg-BG' })

// Watch voice transcript and update input
watch(voiceTranscript, (newTranscript) => {
  if (newTranscript) {
    inputMessage.value = newTranscript
  }
})

// Toggle voice input
const handleVoiceToggle = () => {
  if (isListening.value) {
    stopVoice()
  } else {
    resetVoice()
    startVoice()
  }
}

// File attachments
const {
  attachments,
  uploading: uploadingFiles,
  error: fileError,
  addAttachment,
  removeAttachment,
  clearAttachments,
  formatFileSize,
  getFileIcon,
  acceptedTypes
} = useFileAttachments()

// File input ref
const fileInputRef = ref(null)

// Handle file selection
const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files || [])

  for (const file of files) {
    await addAttachment(file)
  }

  // Clear input to allow selecting same file again
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// Open file picker
const openFilePicker = () => {
  fileInputRef.value?.click()
}

const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && !props.disabled && !props.loading
})

async function handleSend() {
  if (!canSend.value) return

  const message = inputMessage.value.trim()
  if (message || attachments.value.length > 0) {
    // TODO: Upload attachments to server and get URLs
    // For now, just send the message
    emit('send', message, attachments.value)

    inputMessage.value = ''
    clearDraft() // Clear draft after sending
    clearAttachments() // Clear attachments after sending
  }
}

function handleEnter() {
  handleSend()
}

function handleShiftEnter() {
  // Allow default behavior (new line)
}
</script>

<style scoped>
.chat-input-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  padding-top: 8px;
}

.draft-indicator {
  position: absolute;
  top: -24px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding: 2px 8px;
  background: rgba(var(--v-theme-success), 0.1);
  border-radius: 4px;
  z-index: 1;
}

.draft-text {
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Voice indicator */
.voice-indicator {
  position: absolute;
  top: -40px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-error));
  padding: 8px 16px;
  background: rgba(var(--v-theme-error), 0.1);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-error), 0.3);
  z-index: 2;
}

.voice-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-error));
  animation: pulse-animation 1.5s ease-in-out infinite;
}

@keyframes pulse-animation {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.3);
  }
}

.voice-text {
  font-weight: 600;
}

.interim-text {
  flex: 1;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-error {
  margin-bottom: 8px;
}

/* Microphone pulse animation */
.mic-pulse {
  animation: mic-pulse-animation 1s ease-in-out infinite;
}

@keyframes mic-pulse-animation {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* File attachments preview */
.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  max-width: 250px;
}

.attachment-image {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.attachment-icon {
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
}

.attachment-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attachment-name {
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.attachment-remove {
  flex-shrink: 0;
}

/* Fade list transition */
.fade-list-enter-active,
.fade-list-leave-active {
  transition: all 0.3s ease;
}

.fade-list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.input-wrapper {
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), 0.12);
  transition: none !important;
}

.input-wrapper:focus-within {
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.input-wrapper * {
  transition: none !important;
}

.message-input {
  background: transparent;
  transition: none !important;
}

.message-input :deep(*) {
  transition: none !important;
}

.message-input :deep(.v-field) {
  border-radius: 16px;
  box-shadow: none;
  padding: 12px 16px;
  transition: none !important;
}

.message-input :deep(.v-field__outline) {
  display: none;
}

.message-input :deep(.v-field__input) {
  font-size: 0.9375rem;
  padding: 4px 0;
  min-height: 48px;
  transition: none !important;
  animation: none !important;
  align-items: flex-start;
  display: flex;
}

.message-input :deep(textarea) {
  transition: none !important;
  animation: none !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  line-height: 1.6 !important;
  font-size: 0.9375rem !important;
  min-height: 48px !important;
}

.message-input :deep(textarea::placeholder) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.message-input :deep(.v-field__input::placeholder) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  position: relative;
  top: 0;
  left: 0;
  transform: none;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
