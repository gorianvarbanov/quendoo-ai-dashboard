<template>
  <div class="chat-input-container">
    <div
      class="input-wrapper"
      :class="{ 'drag-over': isDragging }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
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

      <!-- Drag overlay -->
      <transition name="fade">
        <div v-if="isDragging" class="drag-overlay">
          <div class="drag-content">
            <v-icon size="48" color="primary">mdi-cloud-upload</v-icon>
            <div class="drag-text">Drop files here</div>
            <div class="drag-subtext">PDF, DOCX, Excel, Images</div>
          </div>
        </div>
      </transition>

      <!-- Draft indicator -->
      <transition name="fade">
        <div v-if="hasDraft && draftSavedAt && !isListening" class="draft-indicator">
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

      <!-- Hidden file input (moved outside textarea for better accessibility) -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/jpeg,image/png"
        @change="handleFileSelect"
        style="display: none;"
      />

      <!-- File attachments preview -->
      <transition-group name="fade-list" tag="div" class="attachments-preview" v-if="attachments.length > 0">
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="attachment-item"
          :class="{ 'uploading': uploadingFiles && !attachment.uploaded, 'uploaded': attachment.uploaded }"
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
            <div class="attachment-size">
              {{ formatFileSize(attachment.size) }}
              <span v-if="attachment.uploaded && attachment.embeddingStatus === 'ready'" class="upload-status success">
                <v-icon size="12" class="ml-1">mdi-check-circle</v-icon>
                Ready
              </span>
              <span v-else-if="attachment.uploaded && attachment.embeddingStatus === 'processing'" class="upload-status processing">
                <v-icon size="12" class="ml-1">mdi-timer-sand</v-icon>
                Processing
              </span>
              <span v-else-if="attachment.uploaded && attachment.embeddingStatus === 'error'" class="upload-status error">
                <v-icon size="12" class="ml-1">mdi-alert-circle</v-icon>
                Error
              </span>
              <span v-else-if="attachment.uploaded" class="upload-status success">
                <v-icon size="12" class="ml-1">mdi-check-circle</v-icon>
                Uploaded
              </span>
              <span v-else-if="uploadingFiles && uploadProgress[attachment.id] !== undefined" class="upload-status uploading">
                <v-icon size="12" class="ml-1">mdi-loading mdi-spin</v-icon>
                {{ uploadProgress[attachment.id] }}%
              </span>
            </div>
          </div>

          <!-- Remove button (disabled during upload) -->
          <v-btn
            icon
            variant="text"
            size="x-small"
            @click="removeAttachment(attachment.id)"
            class="attachment-remove"
            :disabled="uploadingFiles"
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
            @click.stop.prevent="openFilePicker"
            size="small"
            variant="text"
            class="mr-1"
            title="Attach files"
          >
            <v-icon size="20">mdi-paperclip</v-icon>
          </v-btn>
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

    <!-- Upload success snackbar -->
    <v-snackbar
      v-model="uploadSuccessSnackbar"
      :timeout="3000"
      color="success"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-check-circle</v-icon>
        {{ uploadSuccessMessage }}
      </div>
    </v-snackbar>
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
const uploadSuccessSnackbar = ref(false)
const uploadSuccessMessage = ref('')

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
  uploadProgress,
  error: fileError,
  addAttachment,
  removeAttachment,
  clearAttachments,
  uploadAttachments,
  formatFileSize,
  getFileIcon,
  acceptedTypes
} = useFileAttachments()

// File input ref
const fileInputRef = ref(null)

// Drag & drop state
const isDragging = ref(false)
let dragCounter = 0 // Track nested drag events

// Handle drag enter
const handleDragEnter = (event) => {
  dragCounter++
  console.log('[ChatInput] Drag enter, counter:', dragCounter, 'types:', event.dataTransfer.types)

  // Check if dragging files
  if (event.dataTransfer.types.includes('Files')) {
    isDragging.value = true
    console.log('[ChatInput] Dragging files detected, isDragging = true')
  }
}

// Handle drag over
const handleDragOver = (event) => {
  event.dataTransfer.dropEffect = 'copy'

  // Make sure isDragging stays true
  if (event.dataTransfer.types.includes('Files') && !isDragging.value) {
    isDragging.value = true
    console.log('[ChatInput] Drag over - activating isDragging')
  }
}

// Handle drag leave
const handleDragLeave = (event) => {
  dragCounter--
  console.log('[ChatInput] Drag leave, counter:', dragCounter)

  // Only set isDragging to false when we've left all nested elements
  if (dragCounter === 0) {
    isDragging.value = false
    console.log('[ChatInput] All drags left, isDragging = false')
  }
}

// Handle drop
const handleDrop = async (event) => {
  dragCounter = 0
  isDragging.value = false

  const files = Array.from(event.dataTransfer.files || [])

  if (files.length === 0) {
    console.log('[ChatInput] No files dropped')
    return
  }

  console.log('[ChatInput] Files dropped:', files.length)

  // Process dropped files same as file picker
  let addedCount = 0
  for (const file of files) {
    console.log('[ChatInput] Adding dropped file:', file.name, file.type, 'size:', file.size)
    const added = await addAttachment(file)
    console.log('[ChatInput] File added result:', added)
    if (added) addedCount++
  }

  // Show error if no files were added
  if (addedCount === 0) {
    console.log('[ChatInput] No files were added - showing error')
    uploadSuccessMessage.value = error.value || 'Files not supported. Only PDF, DOCX, Excel, and Images are allowed.'
    uploadSuccessSnackbar.value = true
    return
  }

  console.log('[ChatInput] All dropped files added. Current attachments:', attachments.value.length)

  // Automatically start upload
  console.log('[ChatInput] Auto-starting upload for', attachments.value.length, 'attachment(s)...')

  try {
    const uploadedDocuments = await uploadAttachments()
    console.log('[ChatInput] Auto-upload complete. Uploaded', uploadedDocuments.length, 'document(s)')

    // Show success notification
    const fileCount = uploadedDocuments.length
    uploadSuccessMessage.value = fileCount === 1
      ? `${uploadedDocuments[0].name} uploaded successfully!`
      : `${fileCount} files uploaded successfully!`
    uploadSuccessSnackbar.value = true
  } catch (err) {
    console.error('[ChatInput] Auto-upload failed:', err)
  }
}

// Handle file selection
const handleFileSelect = async (event) => {
  console.log('[ChatInput] File input changed, files:', event.target.files)
  const files = Array.from(event.target.files || [])

  if (files.length === 0) {
    console.log('[ChatInput] No files selected')
    return
  }

  console.log('[ChatInput] Processing', files.length, 'file(s)')

  for (const file of files) {
    console.log('[ChatInput] Adding file:', file.name, file.type, 'size:', file.size)
    const added = await addAttachment(file)
    console.log('[ChatInput] File added result:', added)
  }

  console.log('[ChatInput] All files added. Current attachments:', attachments.value.length)

  // Clear input to allow selecting same file again
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }

  // Automatically start upload after file is added
  console.log('[ChatInput] Auto-starting upload for', attachments.value.length, 'attachment(s)...')
  console.log('[ChatInput] Attachments before upload:', attachments.value.map(a => ({ name: a.name, uploaded: a.uploaded })))

  try {
    const uploadedDocuments = await uploadAttachments()
    console.log('[ChatInput] Auto-upload complete. Uploaded', uploadedDocuments.length, 'document(s):', uploadedDocuments.map(d => d.documentId))

    // Show success notification
    const fileCount = uploadedDocuments.length
    uploadSuccessMessage.value = fileCount === 1
      ? `${uploadedDocuments[0].name} uploaded successfully!`
      : `${fileCount} files uploaded successfully!`
    uploadSuccessSnackbar.value = true
  } catch (err) {
    console.error('[ChatInput] Auto-upload failed:', err)
    console.error('[ChatInput] Error details:', err.message, err.response?.data)
    // Error is already set in uploadAttachments composable
  }
}

// Open file picker
const openFilePicker = () => {
  console.log('[ChatInput] ========== OPEN FILE PICKER CALLED ==========')
  console.log('[ChatInput] fileInputRef.value:', fileInputRef.value)
  console.log('[ChatInput] Type of ref:', typeof fileInputRef.value)

  if (fileInputRef.value) {
    console.log('[ChatInput] Calling click() on file input')
    try {
      fileInputRef.value.click()
      console.log('[ChatInput] Click triggered successfully')
    } catch (err) {
      console.error('[ChatInput] Error clicking file input:', err)
    }
  } else {
    console.error('[ChatInput] File input ref is null or undefined')
  }
}

const canSend = computed(() => {
  const hasMessage = inputMessage.value.trim().length > 0 || attachments.value.length > 0
  return hasMessage && !props.disabled && !props.loading && !uploadingFiles.value
})

async function handleSend() {
  if (!canSend.value) return

  const message = inputMessage.value.trim()
  if (message || attachments.value.length > 0) {
    try {
      // Collect document IDs from already uploaded attachments
      // (files are now uploaded automatically when selected)
      const uploadedDocuments = attachments.value.filter(a => a.uploaded && a.documentId)

      // If there are unuploaded attachments, upload them now
      const unuploadedAttachments = attachments.value.filter(a => !a.uploaded)
      if (unuploadedAttachments.length > 0) {
        console.log('[ChatInput] Uploading remaining attachments...')
        const newlyUploaded = await uploadAttachments()
        uploadedDocuments.push(...newlyUploaded)

        // Show success notification
        const fileCount = newlyUploaded.length
        uploadSuccessMessage.value = fileCount === 1
          ? `${newlyUploaded[0].name} uploaded successfully!`
          : `${fileCount} files uploaded successfully!`
        uploadSuccessSnackbar.value = true
      }

      console.log('[ChatInput] Sending message with documents:', uploadedDocuments.map(d => d.documentId))

      // Send message with document IDs
      const messageData = {
        content: message,
        documentIds: uploadedDocuments.map(doc => doc.documentId).filter(Boolean)
      }

      emit('send', messageData)

      inputMessage.value = ''
      clearDraft() // Clear draft after sending
      clearAttachments() // Clear attachments after sending
    } catch (err) {
      console.error('[ChatInput] Failed to send message with attachments:', err)
      // Keep attachments so user can retry
      // Error message is already set in uploadAttachments
    }
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
}

.draft-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding: 6px 12px;
  background: rgba(var(--v-theme-success), 0.08);
  border-radius: 8px 8px 0 0;
}

.draft-text {
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Voice indicator */
.voice-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-error));
  padding: 10px 16px;
  background: rgba(var(--v-theme-error), 0.08);
  border-radius: 8px 8px 0 0;
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
  margin: 12px 12px 0 12px;
  border-radius: 8px;
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
  transition: all 0.3s ease;
}

.attachment-item.uploading {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.3);
  animation: pulse-border 1.5s ease-in-out infinite;
}

.attachment-item.uploaded {
  background: rgba(var(--v-theme-success), 0.08);
  border-color: rgba(var(--v-theme-success), 0.3);
}

@keyframes pulse-border {
  0%, 100% {
    border-color: rgba(var(--v-theme-primary), 0.3);
  }
  50% {
    border-color: rgba(var(--v-theme-primary), 0.6);
  }
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.upload-status {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 4px;
}

.upload-status.success {
  color: rgb(var(--v-theme-success));
}

/* Drag & Drop styles */
.input-wrapper.drag-over {
  opacity: 0.9;
  transform: scale(1.01);
  transition: all 0.2s ease;
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--v-theme-primary), 0.15);
  border: 3px dashed rgb(var(--v-theme-primary));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
  backdrop-filter: blur(10px);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.15);
  }
  50% {
    border-color: rgba(var(--v-theme-primary), 0.7);
    background: rgba(var(--v-theme-primary), 0.08);
  }
}

.drag-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  animation: bounce-subtle 1s ease-in-out infinite;
}

@keyframes bounce-subtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

.drag-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.drag-subtext {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.upload-status.uploading {
  color: rgb(var(--v-theme-primary));
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
  position: relative;
  background: rgb(var(--v-theme-surface));
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s ease;
  overflow: hidden;
}

.input-wrapper:focus-within {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12), 0 0 0 2px rgb(var(--v-theme-primary));
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
  border-radius: 0;
  box-shadow: none;
  padding: 12px 16px;
  transition: none !important;
  background: transparent;
}

.message-input :deep(.v-field__outline) {
  display: none;
}

.message-input :deep(.v-field__prepend-inner) {
  padding-top: 12px;
}

.message-input :deep(.v-field__append-inner) {
  padding-top: 12px;
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
