import { ref } from 'vue'

/**
 * File attachments composable for handling file uploads
 */
export function useFileAttachments(options = {}) {
  const {
    maxFiles = 5,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    acceptedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.txt', '.xlsx', '.csv']
  } = options

  const attachments = ref([])
  const uploading = ref(false)
  const uploadProgress = ref({})
  const error = ref(null)

  // Add file attachment
  const addAttachment = async (file) => {
    // Validate file count
    if (attachments.value.length >= maxFiles) {
      error.value = `Maximum ${maxFiles} files allowed`
      return false
    }

    // Validate file size
    if (file.size > maxFileSize) {
      const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(0)
      error.value = `File size must be less than ${sizeMB}MB`
      return false
    }

    // Create attachment object
    const attachment = {
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: null,
      uploaded: false
    }

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      attachment.preview = await generateImagePreview(file)
    }

    attachments.value.push(attachment)
    error.value = null

    console.log('[FileAttachments] Added attachment:', attachment.name)
    return true
  }

  // Remove attachment
  const removeAttachment = (attachmentId) => {
    const index = attachments.value.findIndex(a => a.id === attachmentId)
    if (index !== -1) {
      const attachment = attachments.value[index]
      attachments.value.splice(index, 1)

      // Revoke object URL if preview exists
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview)
      }

      console.log('[FileAttachments] Removed attachment:', attachment.name)
    }
  }

  // Clear all attachments
  const clearAttachments = () => {
    // Revoke all preview URLs
    attachments.value.forEach(attachment => {
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview)
      }
    })

    attachments.value = []
    uploadProgress.value = {}
    error.value = null

    console.log('[FileAttachments] Cleared all attachments')
  }

  // Upload attachments to server
  const uploadAttachments = async () => {
    if (attachments.value.length === 0) {
      return []
    }

    uploading.value = true
    const uploadedFiles = []

    try {
      for (const attachment of attachments.value) {
        if (attachment.uploaded) {
          uploadedFiles.push(attachment)
          continue
        }

        // TODO: Implement actual upload to your backend
        // For now, simulating upload
        uploadProgress.value[attachment.id] = 0

        // Simulate upload progress
        await new Promise((resolve) => {
          let progress = 0
          const interval = setInterval(() => {
            progress += 10
            uploadProgress.value[attachment.id] = progress

            if (progress >= 100) {
              clearInterval(interval)
              attachment.uploaded = true
              uploadedFiles.push(attachment)
              resolve()
            }
          }, 100)
        })
      }

      console.log('[FileAttachments] All files uploaded successfully')
      return uploadedFiles
    } catch (err) {
      console.error('[FileAttachments] Upload failed:', err)
      error.value = 'Failed to upload files'
      throw err
    } finally {
      uploading.value = false
    }
  }

  // Generate image preview
  const generateImagePreview = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        resolve(e.target.result)
      }

      reader.onerror = () => {
        resolve(null)
      }

      reader.readAsDataURL(file)
    })
  }

  // Generate unique ID
  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file icon based on type
  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return 'mdi-file-image'
    if (type.includes('pdf')) return 'mdi-file-pdf-box'
    if (type.includes('word') || type.includes('document')) return 'mdi-file-word'
    if (type.includes('excel') || type.includes('spreadsheet')) return 'mdi-file-excel'
    if (type.includes('text')) return 'mdi-file-document'
    return 'mdi-file'
  }

  return {
    attachments,
    uploading,
    uploadProgress,
    error,
    maxFiles,
    maxFileSize,
    acceptedTypes,
    addAttachment,
    removeAttachment,
    clearAttachments,
    uploadAttachments,
    formatFileSize,
    getFileIcon
  }
}
