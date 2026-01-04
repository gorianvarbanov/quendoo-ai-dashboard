<template>
  <admin-layout>
    <div class="admin-content">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <v-icon size="large" class="mr-2">mdi-cog</v-icon>
            Security Configuration
          </h1>
          <p class="page-subtitle">Manage security rules, patterns, and rate limits</p>
        </div>
        <v-btn
          color="primary"
          variant="outlined"
          @click="loadConfig"
          :loading="loading"
        >
          <v-icon class="mr-2">mdi-refresh</v-icon>
          Refresh Config
        </v-btn>
      </div>

      <!-- Success/Error Alerts -->
      <v-alert
        v-if="successMessage"
        type="success"
        variant="tonal"
        class="mb-6"
        closable
        @click:close="successMessage = null"
      >
        {{ successMessage }}
      </v-alert>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="mb-6"
        closable
        @click:close="error = null"
      >
        {{ error }}
      </v-alert>

      <!-- Configuration Sections -->
      <div class="config-grid">

        <!-- Injection Patterns -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-shield-alert</v-icon>
              <h2 class="header-title">Injection Patterns</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Regex patterns to detect prompt injection attempts
            </p>

            <!-- Current Patterns -->
            <v-list class="pattern-list">
              <v-list-item
                v-for="(pattern, index) in config.input?.injectionPatterns || []"
                :key="index"
                class="pattern-item"
              >
                <template v-slot:prepend>
                  <v-icon size="small" color="warning">mdi-regex</v-icon>
                </template>
                <v-list-item-title class="pattern-text">
                  {{ pattern }}
                </v-list-item-title>
              </v-list-item>
            </v-list>

            <!-- Add New Pattern -->
            <v-divider class="my-4"></v-divider>

            <div class="add-section">
              <v-text-field
                v-model="newInjectionPattern"
                label="New Injection Pattern"
                placeholder="e.g., bypass\\s+security"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              >
                <template v-slot:prepend-inner>
                  <v-icon size="small">mdi-regex</v-icon>
                </template>
              </v-text-field>

              <v-select
                v-model="newInjectionFlags"
                :items="['i', 'g', 'ig', 'gm', 'gim']"
                label="Regex Flags"
                variant="outlined"
                density="comfortable"
                hide-details
                class="mb-3"
              ></v-select>

              <v-btn
                color="primary"
                block
                @click="addInjectionPattern"
                :loading="addingPattern"
              >
                <v-icon class="mr-2">mdi-plus</v-icon>
                Add Pattern
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Off-Topic Keywords -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-tag-multiple</v-icon>
              <h2 class="header-title">Off-Topic Keywords</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Keywords that trigger off-topic detection
            </p>

            <!-- Categories -->
            <v-expansion-panels variant="accordion" class="mb-4">
              <v-expansion-panel
                v-for="(keywords, category) in config.input?.offTopicKeywords || {}"
                :key="category"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center gap-2">
                    <v-icon size="small">mdi-folder</v-icon>
                    <strong>{{ category }}</strong>
                    <v-chip size="x-small" variant="tonal">
                      {{ keywords.length }} keywords
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-chip
                    v-for="(keyword, idx) in keywords"
                    :key="idx"
                    size="small"
                    class="ma-1"
                  >
                    {{ keyword }}
                  </v-chip>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Add New Keywords -->
            <v-divider class="my-4"></v-divider>

            <div class="add-section">
              <div class="d-flex align-center gap-2 mb-3">
                <v-select
                  v-model="selectedCategory"
                  :items="Object.keys(config.input?.offTopicKeywords || {})"
                  label="Select Existing Category"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  :disabled="isCreatingNewCategory"
                  style="flex: 1;"
                ></v-select>
                <v-btn
                  variant="tonal"
                  color="primary"
                  @click="toggleNewCategory"
                  :prepend-icon="isCreatingNewCategory ? 'mdi-arrow-left' : 'mdi-plus'"
                >
                  {{ isCreatingNewCategory ? 'Back' : 'New' }}
                </v-btn>
              </div>

              <v-text-field
                v-if="isCreatingNewCategory"
                v-model="newCategoryName"
                label="New Category Name"
                placeholder="e.g., sports, finance, legal"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              >
                <template v-slot:prepend-inner>
                  <v-icon size="small">mdi-folder-plus</v-icon>
                </template>
              </v-text-field>

              <v-combobox
                v-model="newOffTopicKeywords"
                label="New Keywords"
                placeholder="Type and press Enter"
                variant="outlined"
                density="comfortable"
                multiple
                chips
                hide-details="auto"
                class="mb-3"
              ></v-combobox>

              <v-btn
                color="primary"
                block
                @click="addOffTopicKeywords"
                :loading="addingKeywords"
                :disabled="(!selectedCategory && !newCategoryName) || newOffTopicKeywords.length === 0"
              >
                <v-icon class="mr-2">mdi-plus</v-icon>
                {{ isCreatingNewCategory ? 'Create Category & Add Keywords' : 'Add Keywords' }}
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Hotel Keywords -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-hotel</v-icon>
              <h2 class="header-title">Hotel Keywords</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Keywords that reduce false positives for hotel queries
            </p>

            <!-- Current Hotel Keywords -->
            <div class="keyword-container">
              <v-chip
                v-for="(keyword, index) in config.input?.hotelKeywords || []"
                :key="index"
                size="small"
                class="ma-1"
                color="primary"
                variant="tonal"
              >
                {{ keyword }}
              </v-chip>
            </div>

            <!-- Add New Hotel Keywords -->
            <v-divider class="my-4"></v-divider>

            <div class="add-section">
              <v-combobox
                v-model="newHotelKeywords"
                label="New Hotel Keywords"
                placeholder="Type and press Enter"
                variant="outlined"
                density="comfortable"
                multiple
                chips
                hide-details="auto"
                class="mb-3"
              ></v-combobox>

              <v-btn
                color="primary"
                block
                @click="addHotelKeywords"
                :loading="addingHotelKeywords"
                :disabled="newHotelKeywords.length === 0"
              >
                <v-icon class="mr-2">mdi-plus</v-icon>
                Add Hotel Keywords
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Rate Limits -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-speedometer</v-icon>
              <h2 class="header-title">Rate Limits</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Control message and tool usage rates
            </p>

            <!-- Current Rate Limits -->
            <div class="rate-limit-section">
              <v-text-field
                v-model.number="rateLimits.maxMessagesPerMinute"
                label="Max Messages Per Minute"
                type="number"
                variant="outlined"
                density="comfortable"
                hide-details
                class="mb-3"
              >
                <template v-slot:prepend-inner>
                  <v-icon size="small">mdi-message</v-icon>
                </template>
              </v-text-field>

              <p class="text-subtitle-2 mb-2 mt-4">Per-Tool Limits:</p>

              <v-card
                v-for="(limit, tool) in rateLimits.perToolLimits || {}"
                :key="tool"
                variant="outlined"
                class="mb-2 pa-3"
              >
                <div class="d-flex align-center gap-2">
                  <v-icon size="small">mdi-tools</v-icon>
                  <span class="text-body-2 font-weight-medium">{{ tool }}:</span>
                  <v-spacer></v-spacer>
                  <v-text-field
                    v-model.number="rateLimits.perToolLimits[tool]"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    style="max-width: 100px;"
                  ></v-text-field>
                  <span class="text-caption">/min</span>
                </div>
              </v-card>

              <v-btn
                color="primary"
                block
                class="mt-4"
                @click="updateRateLimits"
                :loading="updatingRateLimits"
              >
                <v-icon class="mr-2">mdi-content-save</v-icon>
                Update Rate Limits
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Tool Management -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-tools</v-icon>
              <h2 class="header-title">Tool Management</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Enable or disable MCP tools
            </p>

            <!-- Disabled Tools -->
            <div class="mb-4">
              <p class="text-subtitle-2 mb-2">Disabled Tools:</p>
              <v-chip
                v-for="tool in config.tools?.disabledTools || []"
                :key="tool"
                size="small"
                class="ma-1"
                color="error"
                variant="tonal"
                closable
                @click:close="enableTool(tool)"
              >
                {{ tool }}
              </v-chip>
              <p v-if="!config.tools?.disabledTools?.length" class="text-caption text-grey">
                No tools are disabled
              </p>
            </div>

            <!-- Disable New Tool -->
            <v-divider class="my-4"></v-divider>

            <div class="add-section">
              <v-text-field
                v-model="toolToDisable"
                label="Tool Name to Disable"
                placeholder="e.g., make_call"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                class="mb-3"
              >
                <template v-slot:prepend-inner>
                  <v-icon size="small">mdi-block-helper</v-icon>
                </template>
              </v-text-field>

              <v-btn
                color="error"
                block
                @click="disableTool"
                :loading="disablingTool"
                :disabled="!toolToDisable"
              >
                <v-icon class="mr-2">mdi-cancel</v-icon>
                Disable Tool
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Current Configuration Info -->
        <v-card elevation="2" class="config-card">
          <div class="card-header">
            <div class="d-flex align-center gap-3">
              <v-icon size="32" class="header-icon">mdi-information</v-icon>
              <h2 class="header-title">Configuration Info</h2>
            </div>
          </div>

          <div class="card-content">
            <p class="section-description">
              Current security configuration status
            </p>

            <div class="info-section">
              <div class="info-row">
                <span class="info-label">Total Injection Patterns:</span>
                <v-chip size="small" color="warning" variant="tonal">
                  {{ config.input?.injectionPatterns?.length || 0 }}
                </v-chip>
              </div>

              <div class="info-row">
                <span class="info-label">Off-Topic Categories:</span>
                <v-chip size="small" color="info" variant="tonal">
                  {{ Object.keys(config.input?.offTopicKeywords || {}).length }}
                </v-chip>
              </div>

              <div class="info-row">
                <span class="info-label">Hotel Keywords:</span>
                <v-chip size="small" color="success" variant="tonal">
                  {{ config.input?.hotelKeywords?.length || 0 }}
                </v-chip>
              </div>

              <div class="info-row">
                <span class="info-label">Disabled Tools:</span>
                <v-chip size="small" color="error" variant="tonal">
                  {{ config.tools?.disabledTools?.length || 0 }}
                </v-chip>
              </div>

              <div class="info-row">
                <span class="info-label">Max Messages/Min:</span>
                <v-chip size="small" color="primary" variant="tonal">
                  {{ config.rateLimits?.maxMessagesPerMinute || 0 }}
                </v-chip>
              </div>
            </div>

            <v-divider class="my-4"></v-divider>

            <v-alert type="info" variant="tonal" density="compact">
              <template v-slot:prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              Changes take effect immediately. Configuration is persisted to server.
            </v-alert>
          </div>
        </v-card>

      </div>
    </div>
  </admin-layout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import AdminLayout from './AdminLayout.vue'
import axios from 'axios'

const authStore = useAuthStore()

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://quendoo-backend-222402522800.us-central1.run.app'

// State
const config = ref({})
const loading = ref(false)
const error = ref(null)
const successMessage = ref(null)

// Injection Patterns
const newInjectionPattern = ref('')
const newInjectionFlags = ref('i')
const addingPattern = ref(false)

// Off-Topic Keywords
const selectedCategory = ref('')
const newOffTopicKeywords = ref([])
const addingKeywords = ref(false)
const isCreatingNewCategory = ref(false)
const newCategoryName = ref('')

// Hotel Keywords
const newHotelKeywords = ref([])
const addingHotelKeywords = ref(false)

// Rate Limits
const rateLimits = ref({
  maxMessagesPerMinute: 20,
  perToolLimits: {}
})
const updatingRateLimits = ref(false)

// Tool Management
const toolToDisable = ref('')
const disablingTool = ref(false)

// Load configuration
const loadConfig = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get(`${API_BASE_URL}/admin/security/config`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    config.value = response.data.config
    rateLimits.value = {
      maxMessagesPerMinute: config.value.rateLimits?.maxMessagesPerMinute || 20,
      perToolLimits: config.value.rateLimits?.perToolLimits || {}
    }

  } catch (err) {
    console.error('Failed to load config:', err)
    error.value = 'Failed to load security configuration. Please check your authentication.'
  } finally {
    loading.value = false
  }
}

// Add injection pattern
const addInjectionPattern = async () => {
  if (!newInjectionPattern.value.trim()) {
    error.value = 'Please enter a pattern'
    return
  }

  addingPattern.value = true
  error.value = null
  successMessage.value = null

  try {
    await axios.post(
      `${API_BASE_URL}/admin/security/injection-patterns/add`,
      {
        pattern: newInjectionPattern.value,
        flags: newInjectionFlags.value
      },
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    successMessage.value = 'Injection pattern added successfully'
    newInjectionPattern.value = ''
    await loadConfig()

  } catch (err) {
    console.error('Failed to add pattern:', err)
    error.value = err.response?.data?.error || 'Failed to add injection pattern'
  } finally {
    addingPattern.value = false
  }
}

// Toggle new category creation mode
const toggleNewCategory = () => {
  isCreatingNewCategory.value = !isCreatingNewCategory.value
  if (isCreatingNewCategory.value) {
    selectedCategory.value = ''
  } else {
    newCategoryName.value = ''
  }
}

// Add off-topic keywords
const addOffTopicKeywords = async () => {
  const categoryToUse = isCreatingNewCategory.value ? newCategoryName.value : selectedCategory.value

  if (!categoryToUse || newOffTopicKeywords.value.length === 0) {
    error.value = 'Please provide a category name and add keywords'
    return
  }

  addingKeywords.value = true
  error.value = null
  successMessage.value = null

  try {
    await axios.post(
      `${API_BASE_URL}/admin/security/off-topic-keywords/add`,
      {
        category: categoryToUse,
        keywords: newOffTopicKeywords.value
      },
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    if (isCreatingNewCategory.value) {
      successMessage.value = `Category '${categoryToUse}' created with ${newOffTopicKeywords.value.length} keywords`
      newCategoryName.value = ''
      isCreatingNewCategory.value = false
    } else {
      successMessage.value = `Keywords added to ${categoryToUse} category`
    }

    newOffTopicKeywords.value = []
    await loadConfig()

  } catch (err) {
    console.error('Failed to add keywords:', err)
    error.value = err.response?.data?.error || 'Failed to add off-topic keywords'
  } finally {
    addingKeywords.value = false
  }
}

// Add hotel keywords
const addHotelKeywords = async () => {
  if (newHotelKeywords.value.length === 0) {
    error.value = 'Please add keywords'
    return
  }

  addingHotelKeywords.value = true
  error.value = null
  successMessage.value = null

  try {
    await axios.post(
      `${API_BASE_URL}/admin/security/hotel-keywords/add`,
      {
        keywords: newHotelKeywords.value
      },
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    successMessage.value = 'Hotel keywords added successfully'
    newHotelKeywords.value = []
    await loadConfig()

  } catch (err) {
    console.error('Failed to add hotel keywords:', err)
    error.value = err.response?.data?.error || 'Failed to add hotel keywords'
  } finally {
    addingHotelKeywords.value = false
  }
}

// Update rate limits
const updateRateLimits = async () => {
  updatingRateLimits.value = true
  error.value = null
  successMessage.value = null

  try {
    await axios.put(
      `${API_BASE_URL}/admin/security/rate-limits`,
      rateLimits.value,
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    successMessage.value = 'Rate limits updated successfully'
    await loadConfig()

  } catch (err) {
    console.error('Failed to update rate limits:', err)
    error.value = err.response?.data?.error || 'Failed to update rate limits'
  } finally {
    updatingRateLimits.value = false
  }
}

// Disable tool
const disableTool = async () => {
  if (!toolToDisable.value.trim()) {
    error.value = 'Please enter a tool name'
    return
  }

  disablingTool.value = true
  error.value = null
  successMessage.value = null

  try {
    await axios.post(
      `${API_BASE_URL}/admin/security/tools/disable`,
      {
        toolName: toolToDisable.value
      },
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    successMessage.value = `Tool '${toolToDisable.value}' disabled successfully`
    toolToDisable.value = ''
    await loadConfig()

  } catch (err) {
    console.error('Failed to disable tool:', err)
    error.value = err.response?.data?.error || 'Failed to disable tool'
  } finally {
    disablingTool.value = false
  }
}

// Enable tool
const enableTool = async (toolName) => {
  error.value = null
  successMessage.value = null

  try {
    await axios.post(
      `${API_BASE_URL}/admin/security/tools/enable`,
      {
        toolName: toolName
      },
      {
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      }
    )

    successMessage.value = `Tool '${toolName}' enabled successfully`
    await loadConfig()

  } catch (err) {
    console.error('Failed to enable tool:', err)
    error.value = err.response?.data?.error || 'Failed to enable tool'
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.admin-content {
  padding: 24px;
  width: 100%;
  max-width: none;
  margin: 0;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 0 24px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  align-items: center;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
}

/* Config Grid */
.config-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.config-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.card-header {
  padding: 40px 48px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.header-icon {
  opacity: 0.7;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

.card-content {
  padding: 48px;
}

.section-description {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 24px;
}

/* Pattern List */
.pattern-list {
  background: transparent;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.pattern-item {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.pattern-item:last-child {
  border-bottom: none;
}

.pattern-text {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
}

/* Keyword Container */
.keyword-container {
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

/* Add Section */
.add-section {
  background: rgba(var(--v-theme-primary), 0.02);
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
  border-radius: 8px;
  padding: 20px;
}

/* Info Section */
.info-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

/* Rate Limit Section */
.rate-limit-section {
  display: flex;
  flex-direction: column;
}
</style>
