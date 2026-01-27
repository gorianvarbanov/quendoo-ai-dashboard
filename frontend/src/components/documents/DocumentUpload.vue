<script setup>
import { ref, computed } from 'vue'
import axios from '@/plugins/axios'

const emit = defineEmits(['uploaded'])

const file = ref(null)
const documentType = ref('other')
const description = ref('')
const tags = ref([])
const tagInput = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)
const error = ref(null)
const success = ref(false)

const documentTypes = [
  { value: 'contract', label: 'Contract' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'menu', label: 'Menu' },
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Other' }
]

const canUpload = computed(() => {
  return file.value !== null && !uploading.value
})

function handleFileChange(event) {
  const selectedFile = event.target.files[0]
  if (selectedFile) {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX only (not old .doc)
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-excel', // XLS
      'image/jpeg', // JPG
      'image/png' // PNG
    ]
    if (!allowedTypes.includes(selectedFile.type)) {
      error.value = 'Only PDF, DOCX (not .doc), Excel (XLSX/XLS), and Image (JPG/PNG) files are allowed'
      file.value = null
      return
    }

    // Validate file size (20 MB for Excel, 5 MB for images, 10 MB for others)
    const isImage = selectedFile.type === 'image/jpeg' || selectedFile.type === 'image/png'
    const isExcel = selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.type === 'application/vnd.ms-excel'

    if (isImage && selectedFile.size > 5 * 1024 * 1024) {
      error.value = 'Image files must be less than 5 MB'
      file.value = null
      return
    } else if (isExcel && selectedFile.size > 20 * 1024 * 1024) {
      error.value = 'Excel files must be less than 20 MB'
      file.value = null
      return
    } else if (!isImage && !isExcel && selectedFile.size > 10 * 1024 * 1024) {
      error.value = 'File size must be less than 10 MB'
      file.value = null
      return
    }

    file.value = selectedFile
    error.value = null
  }
}

function addTag() {
  if (tagInput.value.trim() && !tags.value.includes(tagInput.value.trim())) {
    tags.value.push(tagInput.value.trim())
    tagInput.value = ''
  }
}

function removeTag(tag) {
  tags.value = tags.value.filter(t => t !== tag)
}

async function uploadDocument() {
  if (!canUpload.value) return

  uploading.value = true
  uploadProgress.value = 0
  error.value = null
  success.value = false

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    formData.append('documentType', documentType.value)
    formData.append('description', description.value)
    formData.append('tags', JSON.stringify(tags.value))

    const response = await axios.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    })

    if (response.data.success) {
      success.value = true
      emit('uploaded', response.data.document)

      // Reset form
      setTimeout(() => {
        resetForm()
      }, 2000)
    }
  } catch (err) {
    console.error('Upload error:', err)
    error.value = err.response?.data?.error || 'Failed to upload document'
  } finally {
    uploading.value = false
  }
}

function resetForm() {
  file.value = null
  documentType.value = 'other'
  description.value = ''
  tags.value = []
  tagInput.value = ''
  uploadProgress.value = 0
  success.value = false
  error.value = null
}
</script>

<template>
  <v-card class="full-width-card" elevation="2">
    <v-card-title class="text-h6 font-weight-bold pa-6 pb-4">
      <v-icon class="mr-2" color="primary">mdi-upload</v-icon>
      Upload Document
    </v-card-title>

    <v-divider />

    <v-card-text class="pa-6">
      <v-row>
        <v-col cols="12">
          <!-- File Upload -->
          <v-file-input
            v-model="file"
            label="Select Document"
            accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
            prepend-icon="mdi-paperclip"
            variant="outlined"
            density="comfortable"
            show-size
            :disabled="uploading"
            @change="handleFileChange"
            hint="PDF, DOCX, Excel, or Image files. Max: 20MB (Excel), 5MB (Images), 10MB (Others)"
            persistent-hint
          />
        </v-col>

        <v-col cols="12" md="6">
          <!-- Document Type -->
          <v-select
            v-model="documentType"
            :items="documentTypes"
            item-title="label"
            item-value="value"
            label="Document Type"
            variant="outlined"
            density="comfortable"
            :disabled="uploading"
          />
        </v-col>

        <v-col cols="12" md="6">
          <!-- Tags -->
          <v-text-field
            v-model="tagInput"
            label="Tags (optional)"
            prepend-icon="mdi-tag"
            variant="outlined"
            density="comfortable"
            :disabled="uploading"
            @keyup.enter="addTag"
          >
            <template #append>
              <v-btn
                icon="mdi-plus"
                size="small"
                variant="text"
                :disabled="!tagInput.trim() || uploading"
                @click="addTag"
              />
            </template>
          </v-text-field>
        </v-col>

        <v-col cols="12">
          <!-- Description -->
          <v-textarea
            v-model="description"
            label="Description (optional)"
            rows="3"
            variant="outlined"
            density="comfortable"
            :disabled="uploading"
          />
        </v-col>
      </v-row>

      <!-- Tags Display -->
      <div v-if="tags.length > 0" class="d-flex flex-wrap gap-2 mt-2">
        <v-chip
          v-for="tag in tags"
          :key="tag"
          closable
          size="small"
          color="primary"
          variant="tonal"
          @click:close="removeTag(tag)"
        >
          {{ tag }}
        </v-chip>
      </div>

      <!-- Upload Progress -->
      <v-progress-linear
        v-if="uploading"
        :model-value="uploadProgress"
        color="primary"
        height="6"
        class="mt-4"
      />

      <!-- Success Message -->
      <v-alert
        v-if="success"
        type="success"
        variant="tonal"
        class="mt-4"
      >
        Document uploaded and processed successfully!
      </v-alert>

      <!-- Error Message -->
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mt-4"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>
    </v-card-text>

    <v-card-actions class="pa-6 pt-4">
      <v-spacer />
      <v-btn
        variant="outlined"
        :disabled="uploading"
        @click="resetForm"
        size="large"
      >
        Clear
      </v-btn>
      <v-btn
        color="primary"
        variant="elevated"
        :disabled="!canUpload"
        :loading="uploading"
        @click="uploadDocument"
        size="large"
        class="ml-3"
      >
        <v-icon left>mdi-upload</v-icon>
        Upload
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.gap-2 {
  gap: 8px;
}

.full-width-card {
  width: 100% !important;
}
</style>
