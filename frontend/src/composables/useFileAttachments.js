import { ref } from 'vue'
import axios from '@/plugins/axios'

/**
 * File attachments composable for handling file uploads
 * Files are uploaded to the document management system with vector embeddings
 */
export function useFileAttachments(options = {}) {
  const {
    maxFiles = 5,
    maxFileSize = 20 * 1024 * 1024, // 20MB default (for Excel files)
    acceptedTypes = [
      'image/*',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
      '.docx',  // DOCX only (not .doc)
      '.pdf',
      '.xlsx',
      '.xls',
      '.jpg',
      '.jpeg',
      '.png'
    ]
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

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX only (not old .doc)
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
      'image/jpeg', // JPG
      'image/png' // PNG
    ]

    if (!allowedMimeTypes.includes(file.type)) {
      error.value = 'Only PDF, DOCX (not .doc), Excel (XLSX/XLS), and Image (JPG/PNG) files are allowed'
      return false
    }

    // Validate file size (20 MB for Excel, 5 MB for images, 10 MB for others)
    const isImage = file.type === 'image/jpeg' || file.type === 'image/png'
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel'

    if (isImage && file.size > 5 * 1024 * 1024) {
      error.value = 'Image files must be less than 5 MB'
      return false
    } else if (isExcel && file.size > 20 * 1024 * 1024) {
      error.value = 'Excel files must be less than 20 MB'
      return false
    } else if (!isImage && !isExcel && file.size > 10 * 1024 * 1024) {
      error.value = 'File size must be less than 10 MB'
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
      uploaded: false,
      documentId: null // Will be set after upload
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

  // Upload attachments to server (document management system)
  const uploadAttachments = async () => {
    console.log('[FileAttachments] uploadAttachments called. Attachments:', attachments.value.length)

    if (attachments.value.length === 0) {
      console.log('[FileAttachments] No attachments to upload')
      return []
    }

    console.log('[FileAttachments] Starting upload process. Setting uploading=true')
    uploading.value = true
    const uploadedFiles = []

    try {
      for (const attachment of attachments.value) {
        console.log(`[FileAttachments] Processing attachment: ${attachment.name}, uploaded: ${attachment.uploaded}`)

        if (attachment.uploaded && attachment.documentId) {
          console.log(`[FileAttachments] ${attachment.name} already uploaded, skipping`)
          uploadedFiles.push(attachment)
          continue
        }

        console.log(`[FileAttachments] Uploading: ${attachment.name} (${attachment.file.type}, ${attachment.size} bytes)`)
        uploadProgress.value[attachment.id] = 0

        try {
          // Create form data for multipart/form-data upload
          const formData = new FormData()
          formData.append('file', attachment.file)
          formData.append('documentType', 'chat_attachment') // Mark as chat attachment
          formData.append('description', `Uploaded via chat on ${new Date().toLocaleString()}`)
          formData.append('tags', JSON.stringify(['chat', 'attachment']))

          // Upload to document management system
          // Note: Don't set Content-Type manually - axios will set it automatically
          // with the correct boundary for multipart/form-data
          const response = await axios.post('/api/documents/upload', formData, {
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              uploadProgress.value[attachment.id] = percentCompleted
            }
          })

          if (response.data.success) {
            attachment.uploaded = true
            attachment.documentId = response.data.document.id
            uploadedFiles.push(attachment)
            console.log(`[FileAttachments] Uploaded successfully: ${attachment.name} (ID: ${attachment.documentId})`)
          } else {
            throw new Error(response.data.error || 'Upload failed')
          }
        } catch (uploadError) {
          console.error(`[FileAttachments] Failed to upload ${attachment.name}:`, uploadError)
          error.value = uploadError.response?.data?.error || `Failed to upload ${attachment.name}`
          throw uploadError
        }
      }

      console.log('[FileAttachments] All files uploaded successfully')
      return uploadedFiles
    } catch (err) {
      console.error('[FileAttachments] Upload failed:', err)
      error.value = err.response?.data?.error || 'Failed to upload files'
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
