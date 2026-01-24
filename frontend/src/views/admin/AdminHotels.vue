<template>
  <div class="admin-hotels">
    <div class="header">
      <h1 class="title">Hotel Management</h1>
      <v-chip
        :color="stats.total > 0 ? 'success' : 'default'"
        size="large"
      >
        {{ stats.total }} Hotel{{ stats.total !== 1 ? 's' : '' }}
      </v-chip>
    </div>

    <!-- Stats Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline text-medium-emphasis">Active Hotels</div>
            <div class="text-h4 mt-2">{{ stats.active }}</div>
            <v-progress-linear
              :model-value="(stats.active / stats.total) * 100"
              color="success"
              height="4"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline text-medium-emphasis">Suspended</div>
            <div class="text-h4 mt-2">{{ stats.suspended }}</div>
            <v-progress-linear
              :model-value="(stats.suspended / stats.total) * 100"
              color="error"
              height="4"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline text-medium-emphasis">On Trial</div>
            <div class="text-h4 mt-2">{{ stats.onTrial }}</div>
            <v-progress-linear
              :model-value="(stats.onTrial / stats.total) * 100"
              color="warning"
              height="4"
              class="mt-2"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="text-overline text-medium-emphasis">Total Messages</div>
            <div class="text-h4 mt-2">{{ stats.totalMessages.toLocaleString() }}</div>
            <div class="text-caption text-medium-emphasis mt-2">
              This month
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Hotels Table -->
    <v-card>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon class="mr-2">mdi-domain</v-icon>
        <span>Registered Hotels</span>
        <v-spacer />
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search hotels..."
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="search-field"
        />
      </v-card-title>

      <v-divider />

      <v-data-table
        :headers="headers"
        :items="filteredHotels"
        :loading="loading"
        :items-per-page="10"
        class="hotels-table"
      >
        <!-- Hotel Name -->
        <template v-slot:item.hotelName="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              color="primary"
              size="32"
              class="mr-2"
            >
              <span class="text-white text-caption">
                {{ item.hotelName.substring(0, 2).toUpperCase() }}
              </span>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.hotelName }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ item.contactEmail }}
              </div>
            </div>
          </div>
        </template>

        <!-- Status -->
        <template v-slot:item.status="{ item }">
          <v-chip
            :color="item.status === 'active' ? 'success' : 'error'"
            size="small"
            variant="flat"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Subscription -->
        <template v-slot:item.subscription="{ item }">
          <div>
            <v-chip
              :color="getSubscriptionColor(item.subscription?.status)"
              size="small"
              variant="tonal"
            >
              {{ item.subscription?.plan || 'N/A' }}
            </v-chip>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ item.subscription?.status || 'N/A' }}
            </div>
          </div>
        </template>

        <!-- Usage -->
        <template v-slot:item.usage="{ item }">
          <div class="text-caption">
            <div>
              <strong>{{ item.usage?.messagesThisMonth || 0 }}</strong> /
              {{ item.limits?.maxMessagesPerMonth === -1 ? '∞' : item.limits?.maxMessagesPerMonth || 0 }} msgs
            </div>
            <div class="text-medium-emphasis">
              {{ item.usage?.conversations || 0 }} conversations
            </div>
          </div>
        </template>

        <!-- Registered Date -->
        <template v-slot:item.registeredAt="{ item }">
          <div class="text-caption">
            {{ formatDate(item.registeredAt) }}
          </div>
        </template>

        <!-- Actions -->
        <template v-slot:item.actions="{ item }">
          <v-menu>
            <template v-slot:activator="{ props }">
              <v-btn
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
                v-bind="props"
              />
            </template>
            <v-list>
              <v-list-item
                prepend-icon="mdi-information-outline"
                @click="viewHotelDetails(item)"
              >
                View Details
              </v-list-item>
              <v-list-item
                prepend-icon="mdi-lock-reset"
                @click="openResetPasswordDialog(item)"
              >
                Reset Password
              </v-list-item>
              <v-divider />
              <v-list-item
                v-if="item.status === 'active'"
                prepend-icon="mdi-pause-circle"
                @click="confirmStatusChange(item, 'suspended')"
              >
                Suspend Account
              </v-list-item>
              <v-list-item
                v-else
                prepend-icon="mdi-play-circle"
                @click="confirmStatusChange(item, 'active')"
              >
                Activate Account
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <!-- Loading State -->
        <template v-slot:loading>
          <v-skeleton-loader
            type="table-row@5"
            :loading="loading"
          />
        </template>

        <!-- No Data State -->
        <template v-slot:no-data>
          <div class="text-center py-8">
            <v-icon size="64" color="grey">mdi-domain-off</v-icon>
            <p class="text-h6 mt-4">No hotels registered yet</p>
            <p class="text-medium-emphasis">
              Hotels will appear here after registration
            </p>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Hotel Details Dialog -->
    <v-dialog
      v-model="detailsDialog"
      max-width="700"
    >
      <v-card v-if="selectedHotel">
        <v-card-title class="d-flex align-center pa-4">
          <v-icon class="mr-2">mdi-information-outline</v-icon>
          <span>Hotel Details</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="detailsDialog = false"
          />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <v-row>
            <v-col cols="12" md="6">
              <div class="detail-section">
                <div class="detail-label">Hotel Name</div>
                <div class="detail-value">{{ selectedHotel.hotelName }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">Contact Email</div>
                <div class="detail-value">{{ selectedHotel.contactEmail }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">Status</div>
                <v-chip
                  :color="selectedHotel.status === 'active' ? 'success' : 'error'"
                  size="small"
                >
                  {{ selectedHotel.status }}
                </v-chip>
              </div>

              <div class="detail-section">
                <div class="detail-label">Registered</div>
                <div class="detail-value">{{ formatDate(selectedHotel.registeredAt) }}</div>
              </div>
            </v-col>

            <v-col cols="12" md="6">
              <div class="detail-section">
                <div class="detail-label">Subscription Plan</div>
                <div class="detail-value">{{ selectedHotel.subscription?.plan || 'N/A' }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">Subscription Status</div>
                <div class="d-flex align-center gap-2">
                  <v-chip
                    :color="getSubscriptionColor(selectedHotel.subscription?.status)"
                    size="small"
                  >
                    {{ selectedHotel.subscription?.status || 'N/A' }}
                  </v-chip>
                  <v-btn
                    icon="mdi-pencil"
                    size="x-small"
                    variant="text"
                    @click="openSubscriptionDialog(selectedHotel)"
                  />
                </div>
              </div>

              <div class="detail-section" v-if="selectedHotel.subscription?.trialEndsAt">
                <div class="detail-label">Trial Ends</div>
                <div class="detail-value">{{ formatDate(selectedHotel.subscription.trialEndsAt) }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">Hotel ID</div>
                <div class="detail-value text-caption">{{ selectedHotel.hotelId }}</div>
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <div class="text-overline mb-2">Usage Statistics</div>
          <v-row>
            <v-col cols="12" md="6">
              <div class="detail-section">
                <div class="detail-label">Messages This Month</div>
                <div class="detail-value">
                  {{ selectedHotel.usage?.messagesThisMonth || 0 }} /
                  {{ selectedHotel.limits?.maxMessagesPerMonth === -1 ? '∞' : selectedHotel.limits?.maxMessagesPerMonth || 0 }}
                </div>
                <v-progress-linear
                  :model-value="getUsagePercentage(selectedHotel.usage?.messagesThisMonth, selectedHotel.limits?.maxMessagesPerMonth)"
                  :color="getUsagePercentage(selectedHotel.usage?.messagesThisMonth, selectedHotel.limits?.maxMessagesPerMonth) > 80 ? 'error' : 'primary'"
                  height="6"
                  class="mt-2"
                />
              </div>
            </v-col>

            <v-col cols="12" md="6">
              <div class="detail-section">
                <div class="detail-label">Total Conversations</div>
                <div class="detail-value">
                  {{ selectedHotel.usage?.conversations || 0 }} /
                  {{ selectedHotel.limits?.maxConversations === -1 ? '∞' : selectedHotel.limits?.maxConversations || 0 }}
                </div>
                <v-progress-linear
                  :model-value="getUsagePercentage(selectedHotel.usage?.conversations, selectedHotel.limits?.maxConversations)"
                  :color="getUsagePercentage(selectedHotel.usage?.conversations, selectedHotel.limits?.maxConversations) > 80 ? 'error' : 'primary'"
                  height="6"
                  class="mt-2"
                />
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Confirm Status Change Dialog -->
    <v-dialog
      v-model="confirmDialog"
      max-width="400"
    >
      <v-card>
        <v-card-title>Confirm Action</v-card-title>
        <v-card-text>
          Are you sure you want to {{ pendingAction === 'active' ? 'activate' : 'suspend' }}
          <strong>{{ pendingHotel?.hotelName }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="confirmDialog = false"
            variant="text"
          >
            Cancel
          </v-btn>
          <v-btn
            :color="pendingAction === 'active' ? 'success' : 'error'"
            @click="updateHotelStatus"
            :loading="updating"
          >
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reset Password Dialog -->
    <v-dialog
      v-model="passwordDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="d-flex align-center pa-4">
          <v-icon class="mr-2">mdi-lock-reset</v-icon>
          <span>Reset Hotel Password</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="closePasswordDialog"
          />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <p class="mb-4">
            Resetting password for: <strong>{{ pendingPasswordHotel?.hotelName }}</strong>
          </p>

          <v-text-field
            v-model="newPassword"
            label="New Password"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            variant="outlined"
            density="comfortable"
            :rules="[
              v => !!v || 'Password is required',
              v => v.length >= 8 || 'Password must be at least 8 characters'
            ]"
            hint="Minimum 8 characters"
            persistent-hint
          />

          <v-text-field
            v-model="confirmPassword"
            label="Confirm Password"
            :type="showConfirmPassword ? 'text' : 'password'"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
            variant="outlined"
            density="comfortable"
            class="mt-4"
            :rules="[
              v => !!v || 'Please confirm password',
              v => v === newPassword || 'Passwords do not match'
            ]"
          />

          <v-alert
            v-if="passwordError"
            type="error"
            variant="tonal"
            class="mt-4"
          >
            {{ passwordError }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            @click="closePasswordDialog"
            variant="text"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="resetPassword"
            :loading="resettingPassword"
            :disabled="!isPasswordValid"
          >
            Reset Password
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Subscription Edit Dialog -->
    <v-dialog
      v-model="subscriptionDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="d-flex align-center pa-4">
          <v-icon class="mr-2">mdi-credit-card-edit</v-icon>
          <span>Edit Subscription</span>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="closeSubscriptionDialog"
          />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <p class="mb-4">
            Editing subscription for: <strong>{{ pendingSubscriptionHotel?.hotelName }}</strong>
          </p>

          <v-select
            v-model="newSubscriptionStatus"
            label="Subscription Status"
            :items="subscriptionStatuses"
            variant="outlined"
            density="comfortable"
          />

          <v-select
            v-model="newSubscriptionPlan"
            label="Subscription Plan"
            :items="subscriptionPlans"
            variant="outlined"
            density="comfortable"
            class="mt-4"
          />

          <v-text-field
            v-model.number="newMaxMessages"
            label="Max Messages Per Month"
            type="number"
            variant="outlined"
            density="comfortable"
            class="mt-4"
            hint="-1 for unlimited"
            persistent-hint
          />

          <v-text-field
            v-model.number="newMaxConversations"
            label="Max Conversations"
            type="number"
            variant="outlined"
            density="comfortable"
            class="mt-4"
            hint="-1 for unlimited"
            persistent-hint
          />

          <v-alert
            v-if="subscriptionError"
            type="error"
            variant="tonal"
            class="mt-4"
          >
            {{ subscriptionError }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            @click="closeSubscriptionDialog"
            variant="text"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="updateSubscription"
            :loading="updatingSubscription"
          >
            Update Subscription
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

// State
const loading = ref(false)
const updating = ref(false)
const resettingPassword = ref(false)
const hotels = ref([])
const search = ref('')
const detailsDialog = ref(false)
const confirmDialog = ref(false)
const passwordDialog = ref(false)
const selectedHotel = ref(null)
const pendingHotel = ref(null)
const pendingPasswordHotel = ref(null)
const pendingAction = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const passwordError = ref('')
const subscriptionDialog = ref(false)
const pendingSubscriptionHotel = ref(null)
const newSubscriptionStatus = ref('')
const newSubscriptionPlan = ref('')
const newMaxMessages = ref(-1)
const newMaxConversations = ref(-1)
const updatingSubscription = ref(false)
const subscriptionError = ref('')
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Subscription options
const subscriptionStatuses = ['trial', 'active', 'expired', 'cancelled']
const subscriptionPlans = ['starter', 'professional', 'premium', 'enterprise']

// Table headers
const headers = [
  { title: 'Hotel', key: 'hotelName', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Subscription', key: 'subscription', sortable: false },
  { title: 'Usage', key: 'usage', sortable: false },
  { title: 'Registered', key: 'registeredAt', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
]

// Computed
const filteredHotels = computed(() => {
  if (!search.value) return hotels.value

  const searchLower = search.value.toLowerCase()
  return hotels.value.filter(hotel =>
    hotel.hotelName.toLowerCase().includes(searchLower) ||
    hotel.contactEmail.toLowerCase().includes(searchLower) ||
    hotel.hotelId.toLowerCase().includes(searchLower)
  )
})

const stats = computed(() => {
  const total = hotels.value.length
  const active = hotels.value.filter(h => h.status === 'active').length
  const suspended = hotels.value.filter(h => h.status === 'suspended').length
  const onTrial = hotels.value.filter(h => h.subscription?.status === 'trial').length
  const totalMessages = hotels.value.reduce((sum, h) => sum + (h.usage?.messagesThisMonth || 0), 0)

  return { total, active, suspended, onTrial, totalMessages }
})

const isPasswordValid = computed(() => {
  return newPassword.value.length >= 8 &&
         confirmPassword.value.length >= 8 &&
         newPassword.value === confirmPassword.value
})

// Methods
async function fetchHotels() {
  loading.value = true
  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
    const token = localStorage.getItem('quendoo-admin-token')

    const response = await axios.get(`${backendUrl}/admin/hotels`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.data.success) {
      hotels.value = response.data.hotels
    }
  } catch (error) {
    console.error('[Admin Hotels] Error fetching hotels:', error)
    showSnackbar('Failed to load hotels', 'error')
  } finally {
    loading.value = false
  }
}

function viewHotelDetails(hotel) {
  selectedHotel.value = hotel
  detailsDialog.value = true
}

function confirmStatusChange(hotel, newStatus) {
  pendingHotel.value = hotel
  pendingAction.value = newStatus
  confirmDialog.value = true
}

async function updateHotelStatus() {
  updating.value = true
  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
    const token = localStorage.getItem('quendoo-admin-token')

    await axios.patch(
      `${backendUrl}/admin/hotels/${pendingHotel.value.hotelId}/status`,
      { status: pendingAction.value },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    // Update local state
    const hotel = hotels.value.find(h => h.hotelId === pendingHotel.value.hotelId)
    if (hotel) {
      hotel.status = pendingAction.value
    }

    showSnackbar(
      `Hotel ${pendingAction.value === 'active' ? 'activated' : 'suspended'} successfully`,
      'success'
    )

    confirmDialog.value = false
  } catch (error) {
    console.error('[Admin Hotels] Error updating hotel status:', error)
    showSnackbar('Failed to update hotel status', 'error')
  } finally {
    updating.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getSubscriptionColor(status) {
  switch (status) {
    case 'trial': return 'warning'
    case 'active': return 'success'
    case 'expired': return 'error'
    case 'cancelled': return 'grey'
    default: return 'default'
  }
}

function getUsagePercentage(used, limit) {
  if (!limit || limit === -1) return 0
  return Math.min(100, (used / limit) * 100)
}

function showSnackbar(message, color = 'success') {
  snackbar.value = {
    show: true,
    message,
    color
  }
}

function openResetPasswordDialog(hotel) {
  pendingPasswordHotel.value = hotel
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  showPassword.value = false
  showConfirmPassword.value = false
  passwordDialog.value = true
}

function closePasswordDialog() {
  passwordDialog.value = false
  pendingPasswordHotel.value = null
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
}

async function resetPassword() {
  if (!isPasswordValid.value) {
    passwordError.value = 'Please enter a valid password'
    return
  }

  resettingPassword.value = true
  passwordError.value = ''

  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
    const token = localStorage.getItem('quendoo-admin-token')

    await axios.patch(
      `${backendUrl}/admin/hotels/${pendingPasswordHotel.value.hotelId}/password`,
      { newPassword: newPassword.value },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    showSnackbar('Hotel password reset successfully', 'success')
    closePasswordDialog()
  } catch (error) {
    console.error('[Admin Hotels] Error resetting password:', error)
    passwordError.value = error.response?.data?.error || 'Failed to reset password'
  } finally {
    resettingPassword.value = false
  }
}

function openSubscriptionDialog(hotel) {
  pendingSubscriptionHotel.value = hotel
  newSubscriptionStatus.value = hotel.subscription?.status || 'trial'
  newSubscriptionPlan.value = hotel.subscription?.plan || 'starter'
  newMaxMessages.value = hotel.limits?.maxMessagesPerMonth ?? -1
  newMaxConversations.value = hotel.limits?.maxConversations ?? -1
  subscriptionError.value = ''
  subscriptionDialog.value = true
}

function closeSubscriptionDialog() {
  subscriptionDialog.value = false
  pendingSubscriptionHotel.value = null
  newSubscriptionStatus.value = ''
  newSubscriptionPlan.value = ''
  newMaxMessages.value = -1
  newMaxConversations.value = -1
  subscriptionError.value = ''
}

async function updateSubscription() {
  updatingSubscription.value = true
  subscriptionError.value = ''

  try {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
    const token = localStorage.getItem('quendoo-admin-token')

    await axios.patch(
      `${backendUrl}/admin/hotels/${pendingSubscriptionHotel.value.hotelId}/subscription`,
      {
        status: newSubscriptionStatus.value,
        plan: newSubscriptionPlan.value,
        limits: {
          maxMessagesPerMonth: newMaxMessages.value,
          maxConversations: newMaxConversations.value
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    // Update local state
    const hotel = hotels.value.find(h => h.hotelId === pendingSubscriptionHotel.value.hotelId)
    if (hotel) {
      hotel.subscription = {
        ...hotel.subscription,
        status: newSubscriptionStatus.value,
        plan: newSubscriptionPlan.value
      }
      hotel.limits = {
        maxMessagesPerMonth: newMaxMessages.value,
        maxConversations: newMaxConversations.value
      }
    }

    // Update selected hotel if it's the same
    if (selectedHotel.value?.hotelId === pendingSubscriptionHotel.value.hotelId) {
      selectedHotel.value = { ...hotel }
    }

    showSnackbar('Subscription updated successfully', 'success')
    closeSubscriptionDialog()
  } catch (error) {
    console.error('[Admin Hotels] Error updating subscription:', error)
    subscriptionError.value = error.response?.data?.error || 'Failed to update subscription'
  } finally {
    updatingSubscription.value = false
  }
}

// Lifecycle
onMounted(() => {
  fetchHotels()
})
</script>

<style scoped>
.admin-hotels {
  padding: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.title {
  font-size: 2rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.search-field {
  max-width: 300px;
}

.hotels-table {
  background: transparent;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 4px;
}

.detail-value {
  font-size: 0.95rem;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
}
</style>
