<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '@/plugins/axios'

const documents = ref([])
const loading = ref(false)
const error = ref(null)
const deleteDialog = ref(false)
const documentToDelete = ref(null)
const deleting = ref(false)
const filterType = ref('')
const search = ref('')

const documentTypeLabels = {
  contract: 'Contract',
  invoice: 'Invoice',
  menu: 'Menu',
  policy: 'Policy',
  procedure: 'Procedure',
  manual: 'Manual',
  other: 'Other'
}

const documentTypes = Object.keys(documentTypeLabels).map(value => ({
  value,
  title: documentTypeLabels[value]
}))

const filteredDocuments = computed(() => {
  let filtered = documents.value

  // Filter by type
  if (filterType.value) {
    filtered = filtered.filter(doc => doc.documentType === filterType.value)
  }

  // Filter by search
  if (search.value) {
    const searchLower = search.value.toLowerCase()
    filtered = filtered.filter(doc =>
      doc.fileName.toLowerCase().includes(searchLower) ||
      doc.description?.toLowerCase().includes(searchLower) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    )
  }

  return filtered
})

onMounted(() => {
  loadDocuments()
})

async function loadDocuments() {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get('/api/documents')

    if (response.data.success) {
      documents.value = response.data.documents
    }
  } catch (err) {
    console.error('Load documents error:', err)
    error.value = err.response?.data?.error || 'Failed to load documents'
  } finally {
    loading.value = false
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A'

  try {
    // Handle Firestore timestamp object {_seconds, _nanoseconds}
    let date
    if (timestamp._seconds) {
      date = new Date(timestamp._seconds * 1000)
    } else if (timestamp.toDate) {
      date = timestamp.toDate()
    } else {
      date = new Date(timestamp)
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'N/A'
    }

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  } catch (error) {
    console.error('Error formatting date:', error, timestamp)
    return 'N/A'
  }
}

function openDeleteDialog(doc) {
  documentToDelete.value = doc
  deleteDialog.value = true
}

async function confirmDelete() {
  if (!documentToDelete.value) return

  deleting.value = true

  try {
    const response = await axios.delete(`/api/documents/${documentToDelete.value.id}`)

    if (response.data.success) {
      // Remove from list
      documents.value = documents.value.filter(doc => doc.id !== documentToDelete.value.id)
      deleteDialog.value = false
      documentToDelete.value = null
    }
  } catch (err) {
    console.error('Delete error:', err)
    error.value = err.response?.data?.error || 'Failed to delete document'
  } finally {
    deleting.value = false
  }
}

function getDocumentIcon(type) {
  const icons = {
    contract: 'mdi-file-document',
    invoice: 'mdi-receipt',
    menu: 'mdi-food',
    policy: 'mdi-shield-check',
    procedure: 'mdi-clipboard-text',
    manual: 'mdi-book-open-page-variant',
    other: 'mdi-file'
  }
  return icons[type] || 'mdi-file'
}

// Check if filename has encoding issues (contains replacement characters)
function hasEncodingIssue(fileName) {
  return fileName && fileName.includes('�')
}

// Clean filename for display - show warning prefix if encoding is broken
function cleanFileName(fileName) {
  if (!fileName) return 'Unknown'

  if (hasEncodingIssue(fileName)) {
    // Replace sequences of � with ellipsis for better readability
    return fileName.replace(/�+/g, '...')
  }

  return fileName
}

defineExpose({ loadDocuments })
</script>

<template>
  <v-card class="full-width-card" elevation="2">
    <v-card-title class="text-h6 font-weight-bold pa-6 pb-4">
      <v-icon class="mr-2" color="primary">mdi-file-multiple</v-icon>
      My Documents
    </v-card-title>

    <v-divider />

    <v-card-text class="pa-6">
      <!-- Filters -->
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            label="Search documents"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
          />
        </v-col>

        <v-col cols="12" md="4">
          <v-select
            v-model="filterType"
            :items="documentTypes"
            label="Document Type"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
          />
        </v-col>
      </v-row>

      <!-- Error Alert -->
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <!-- Empty State -->
      <div v-else-if="documents.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-file-outline</v-icon>
        <p class="text-h6 mt-4">No documents uploaded yet</p>
        <p class="text-body-2 text-medium-emphasis">Upload your first document to get started</p>
      </div>

      <!-- Documents List -->
      <v-list v-else-if="filteredDocuments.length > 0" lines="three">
        <v-list-item
          v-for="doc in filteredDocuments"
          :key="doc.id"
          class="mb-2"
        >
          <template #prepend>
            <v-avatar color="primary" variant="tonal">
              <v-icon :icon="getDocumentIcon(doc.documentType)" />
            </v-avatar>
          </template>

          <v-list-item-title>
            <div class="d-flex align-center gap-2">
              <span>{{ cleanFileName(doc.fileName) }}</span>
              <v-tooltip
                v-if="hasEncodingIssue(doc.fileName)"
                text="Този файл е качен с проблем в кодирането на името. Препоръчваме да го изтриеш и качиш отново за правилно показване."
                location="top"
              >
                <template v-slot:activator="{ props }">
                  <v-icon
                    icon="mdi-alert-circle"
                    size="small"
                    color="warning"
                    v-bind="props"
                  ></v-icon>
                </template>
              </v-tooltip>
            </div>
          </v-list-item-title>

          <v-list-item-subtitle>
            <div class="d-flex flex-column gap-1 mt-1">
              <div>
                <v-chip size="x-small" variant="tonal" class="mr-2">
                  {{ documentTypeLabels[doc.documentType] }}
                </v-chip>
                <span class="text-caption">{{ formatFileSize(doc.fileSize) }}</span>
              </div>
              <div v-if="doc.description" class="text-caption">
                {{ doc.description }}
              </div>
              <div v-if="doc.tags && doc.tags.length > 0" class="d-flex flex-wrap gap-1 mt-1">
                <v-chip
                  v-for="tag in doc.tags"
                  :key="tag"
                  size="x-small"
                  variant="outlined"
                >
                  {{ tag }}
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                Uploaded: {{ formatDate(doc.createdAt) }}
              </div>
            </div>
          </v-list-item-subtitle>

          <template #append>
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              size="small"
              @click="openDeleteDialog(doc)"
            />
          </template>
        </v-list-item>
      </v-list>

      <!-- No Results -->
      <div v-else class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-magnify</v-icon>
        <p class="text-h6 mt-4">No documents found</p>
        <p class="text-body-2 text-medium-emphasis">Try adjusting your filters</p>
      </div>
    </v-card-text>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          Delete Document
        </v-card-title>

        <v-divider />

        <v-card-text>
          <p>Are you sure you want to delete this document?</p>
          <p class="font-weight-bold mt-2">{{ documentToDelete?.fileName }}</p>
          <p class="text-caption text-medium-emphasis mt-2">
            This action cannot be undone. The document and all its vector data will be permanently deleted.
          </p>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="deleting"
            @click="deleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleting"
            @click="confirmDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.gap-1 {
  gap: 4px;
}

.gap-3 {
  gap: 12px;
}

.full-width-card {
  width: 100% !important;
}
</style>
