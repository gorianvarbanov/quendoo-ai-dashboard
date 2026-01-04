<template>
  <admin-layout>
    <div class="admin-conversations">
      <v-container fluid>
        <!-- Header -->
        <v-row>
          <v-col cols="12">
            <div class="page-header">
              <v-icon size="32" color="primary" class="mr-3">mdi-message-text-outline</v-icon>
              <div>
                <h1 class="text-h4 font-weight-bold">All Conversations</h1>
                <p class="text-subtitle-1 text-medium-emphasis mt-1">
                  View and monitor all user conversations
                </p>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- Stats Cards -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon size="40" color="primary" class="mr-3">mdi-message-text</v-icon>
                  <div>
                    <div class="text-h4">{{ totalConversations }}</div>
                    <div class="text-caption text-medium-emphasis">Total Conversations</div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon size="40" color="success" class="mr-3">mdi-clock-outline</v-icon>
                  <div>
                    <div class="text-h4">{{ todayConversations }}</div>
                    <div class="text-caption text-medium-emphasis">Today</div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon size="40" color="info" class="mr-3">mdi-calendar-week</v-icon>
                  <div>
                    <div class="text-h4">{{ weekConversations }}</div>
                    <div class="text-caption text-medium-emphasis">This Week</div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card>
              <v-card-text>
                <div class="d-flex align-center">
                  <v-icon size="40" color="warning" class="mr-3">mdi-chart-line</v-icon>
                  <div>
                    <div class="text-h4">{{ totalMessages }}</div>
                    <div class="text-caption text-medium-emphasis">Total Messages</div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Filters and Search -->
        <v-row>
          <v-col cols="12">
            <v-card>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="searchQuery"
                      prepend-inner-icon="mdi-magnify"
                      label="Search conversations"
                      variant="outlined"
                      density="comfortable"
                      clearable
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-select
                      v-model="sortBy"
                      :items="sortOptions"
                      label="Sort by"
                      variant="outlined"
                      density="comfortable"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-btn
                      color="primary"
                      block
                      size="large"
                      prepend-icon="mdi-refresh"
                      @click="loadConversations"
                      :loading="loading"
                    >
                      Refresh
                    </v-btn>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Conversations List -->
        <v-row>
          <v-col cols="12">
            <v-card>
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-format-list-bulleted</v-icon>
                Conversations
                <v-spacer />
                <v-chip color="primary" variant="tonal">
                  {{ filteredConversations.length }} conversations
                </v-chip>
              </v-card-title>

              <v-card-text v-if="loading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" size="64" />
                <p class="mt-4 text-medium-emphasis">Loading conversations...</p>
              </v-card-text>

              <v-card-text v-else-if="filteredConversations.length === 0" class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1">mdi-message-off-outline</v-icon>
                <p class="mt-4 text-h6 text-medium-emphasis">No conversations found</p>
              </v-card-text>

              <v-list v-else class="pa-0">
                <v-list-item
                  v-for="conversation in paginatedConversations"
                  :key="conversation.id"
                  class="conversation-item"
                  @click="viewConversation(conversation)"
                >
                  <template v-slot:prepend>
                    <v-avatar color="primary" size="48">
                      <v-icon>mdi-message-text</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="text-subtitle-1 font-weight-medium">
                    {{ conversation.title || 'Untitled Conversation' }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <v-chip size="x-small" color="info" variant="tonal" class="mr-2">
                      {{ conversation.messageCount || 0 }} messages
                    </v-chip>
                    <span class="text-caption">
                      Created: {{ formatDate(conversation.createdAt) }}
                    </span>
                    <span v-if="conversation.updatedAt" class="text-caption ml-2">
                      • Updated: {{ formatDate(conversation.updatedAt) }}
                    </span>
                  </v-list-item-subtitle>

                  <template v-slot:append>
                    <v-btn
                      icon
                      variant="text"
                      size="small"
                      @click.stop="deleteConversation(conversation.id)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>

              <!-- Pagination -->
              <v-card-actions v-if="filteredConversations.length > itemsPerPage">
                <v-spacer />
                <v-pagination
                  v-model="currentPage"
                  :length="totalPages"
                  :total-visible="7"
                  rounded="circle"
                />
                <v-spacer />
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Conversation Details Dialog -->
      <v-dialog v-model="dialogOpen" max-width="900">
        <v-card v-if="selectedConversation">
          <v-card-title class="d-flex align-center bg-primary">
            <v-icon class="mr-2">mdi-message-text</v-icon>
            {{ selectedConversation.title || 'Untitled Conversation' }}
            <v-spacer />
            <v-btn icon variant="text" @click="dialogOpen = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>

          <v-card-text class="pa-0">
            <div class="conversation-info pa-4 bg-surface-variant">
              <v-row dense>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Conversation ID</div>
                  <div class="text-body-2 font-weight-medium">{{ selectedConversation.id }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Messages</div>
                  <div class="text-body-2 font-weight-medium">{{ selectedConversation.messageCount || 0 }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Created</div>
                  <div class="text-body-2 font-weight-medium">{{ formatDate(selectedConversation.createdAt) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Last Updated</div>
                  <div class="text-body-2 font-weight-medium">{{ formatDate(selectedConversation.updatedAt) }}</div>
                </v-col>
              </v-row>
            </div>

            <v-divider />

            <!-- Messages -->
            <div v-if="loadingMessages" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-4 text-caption">Loading messages...</p>
            </div>

            <div v-else-if="conversationMessages.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-message-off</v-icon>
              <p class="mt-2 text-caption">No messages in this conversation</p>
            </div>

            <div v-else class="messages-container pa-4">
              <div
                v-for="(message, index) in conversationMessages"
                :key="index"
                class="message-item mb-4"
                :class="message.role"
              >
                <div class="message-header d-flex align-center mb-2">
                  <v-chip
                    :color="message.role === 'user' ? 'primary' : 'success'"
                    size="small"
                    variant="tonal"
                  >
                    {{ message.role === 'user' ? 'User' : 'Assistant' }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis ml-2">
                    {{ formatTimestamp(message.timestamp) }}
                  </span>
                </div>
                <div class="message-content pa-3 rounded">
                  {{ message.content }}
                </div>
              </div>
            </div>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn color="error" variant="text" @click="deleteConversation(selectedConversation.id)">
              Delete Conversation
            </v-btn>
            <v-btn color="primary" variant="text" @click="dialogOpen = false">
              Close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Delete Confirmation Dialog -->
      <v-dialog v-model="deleteDialog" max-width="500">
        <v-card>
          <v-card-title class="bg-error">
            <v-icon class="mr-2">mdi-alert</v-icon>
            Delete Conversation
          </v-card-title>
          <v-card-text class="pt-4">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
            <v-btn color="error" variant="text" @click="confirmDelete" :loading="deleting">
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </admin-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AdminLayout from './AdminLayout.vue'
import chatApi from '@/services/api'

// State
const loading = ref(false)
const conversations = ref([])
const searchQuery = ref('')
const sortBy = ref('newest')
const currentPage = ref(1)
const itemsPerPage = ref(20)

// Dialog state
const dialogOpen = ref(false)
const selectedConversation = ref(null)
const conversationMessages = ref([])
const loadingMessages = ref(false)

// Delete state
const deleteDialog = ref(false)
const conversationToDelete = ref(null)
const deleting = ref(false)

// Sort options
const sortOptions = [
  { title: 'Newest First', value: 'newest' },
  { title: 'Oldest First', value: 'oldest' },
  { title: 'Most Messages', value: 'messages' },
  { title: 'Title A-Z', value: 'title' }
]

// Computed
const totalConversations = computed(() => conversations.value.length)

const todayConversations = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return conversations.value.filter(conv => {
    const createdAt = new Date(conv.createdAt)
    return createdAt >= today
  }).length
})

const weekConversations = computed(() => {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return conversations.value.filter(conv => {
    const createdAt = new Date(conv.createdAt)
    return createdAt >= weekAgo
  }).length
})

const totalMessages = computed(() => {
  return conversations.value.reduce((sum, conv) => sum + (conv.messageCount || 0), 0)
})

const filteredConversations = computed(() => {
  let filtered = [...conversations.value]

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(conv =>
      (conv.title || '').toLowerCase().includes(query) ||
      conv.id.toLowerCase().includes(query)
    )
  }

  // Sort
  switch (sortBy.value) {
    case 'newest':
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      break
    case 'oldest':
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      break
    case 'messages':
      filtered.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0))
      break
    case 'title':
      filtered.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'))
      break
  }

  return filtered
})

const totalPages = computed(() => {
  return Math.ceil(filteredConversations.value.length / itemsPerPage.value)
})

const paginatedConversations = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredConversations.value.slice(start, end)
})

// Methods
const loadConversations = async () => {
  loading.value = true
  try {
    const response = await chatApi.getConversations()
    if (response.conversations && Array.isArray(response.conversations)) {
      conversations.value = response.conversations.map(conv => ({
        id: conv.id,
        title: conv.title || 'Untitled Conversation',
        createdAt: conv.createdAt?._seconds
          ? new Date(conv.createdAt._seconds * 1000).toISOString()
          : conv.createdAt,
        updatedAt: conv.updatedAt?._seconds
          ? new Date(conv.updatedAt._seconds * 1000).toISOString()
          : conv.updatedAt,
        messageCount: conv.messageCount || 0
      }))
      console.log(`[Admin] Loaded ${conversations.value.length} conversations`)
    }
  } catch (error) {
    console.error('[Admin] Failed to load conversations:', error)
  } finally {
    loading.value = false
  }
}

const viewConversation = async (conversation) => {
  selectedConversation.value = conversation
  dialogOpen.value = true
  loadingMessages.value = true
  conversationMessages.value = []

  try {
    const response = await chatApi.getConversation(conversation.id)
    if (response.conversation && response.conversation.messages) {
      conversationMessages.value = response.conversation.messages
    }
  } catch (error) {
    console.error('[Admin] Failed to load messages:', error)
  } finally {
    loadingMessages.value = false
  }
}

const deleteConversation = (conversationId) => {
  conversationToDelete.value = conversationId
  deleteDialog.value = true
  dialogOpen.value = false
}

const confirmDelete = async () => {
  if (!conversationToDelete.value) return

  deleting.value = true
  try {
    await chatApi.deleteConversation(conversationToDelete.value)
    conversations.value = conversations.value.filter(
      conv => conv.id !== conversationToDelete.value
    )
    deleteDialog.value = false
    conversationToDelete.value = null
    console.log('[Admin] Conversation deleted successfully')
  } catch (error) {
    console.error('[Admin] Failed to delete conversation:', error)
  } finally {
    deleting.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Lifecycle
onMounted(() => {
  loadConversations()
})
</script>

<style scoped>
.admin-conversations {
  min-height: 100vh;
  background: rgb(var(--v-theme-surface));
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.conversation-item {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  cursor: pointer;
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.messages-container {
  max-height: 500px;
  overflow-y: auto;
}

.message-item {
  display: flex;
  flex-direction: column;
}

.message-item.user .message-content {
  background: rgba(var(--v-theme-primary), 0.1);
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.message-item.assistant .message-content {
  background: rgba(var(--v-theme-success), 0.1);
  border-left: 3px solid rgb(var(--v-theme-success));
}

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.6;
  font-size: 14px;
}

.conversation-info {
  border-radius: 0;
}
</style>
