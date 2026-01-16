<template>
  <div class="admin-layout">
    <!-- Top App Bar -->
    <v-app-bar color="primary" prominent app>
      <v-app-bar-nav-icon
        class="d-md-none"
        @click="drawer = !drawer"
      />

      <v-toolbar-title>
        <v-icon class="mr-2">mdi-shield-account</v-icon>
        Quendoo Admin Panel
      </v-toolbar-title>

      <v-spacer />

      <v-chip class="mr-4" color="white" variant="outlined">
        <v-icon left class="mr-1">mdi-account-circle</v-icon>
        {{ user?.username || 'Admin' }}
      </v-chip>

      <v-btn icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Permanent Navigation Drawer (Desktop) -->
    <v-navigation-drawer
      v-model="drawer"
      :permanent="$vuetify.display.mdAndUp"
      :temporary="$vuetify.display.smAndDown"
      width="280"
      app
    >
      <v-list nav class="pa-2">
        <v-list-item
          :to="'/admin'"
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          value="dashboard"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/conversations'"
          prepend-icon="mdi-message-text-outline"
          title="Conversations"
          value="conversations"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/analytics'"
          prepend-icon="mdi-chart-line"
          title="Analytics"
          value="analytics"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/settings'"
          prepend-icon="mdi-cog"
          title="Settings"
          value="settings"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/hotels'"
          prepend-icon="mdi-domain"
          title="Hotels"
          value="hotels"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/security'"
          prepend-icon="mdi-security"
          title="Security Monitor"
          value="security"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/security-config'"
          prepend-icon="mdi-shield-lock-outline"
          title="Security Config"
          value="security-config"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/integration'"
          prepend-icon="mdi-puzzle"
          title="Integration"
          value="integration"
          rounded="lg"
          class="mb-1"
        />
        <v-list-item
          :to="'/admin/currency'"
          prepend-icon="mdi-currency-usd"
          title="Currency Rates"
          value="currency"
          rounded="lg"
          class="mb-1"
        />

        <v-divider class="my-3" />

        <v-list-item
          :to="'/'"
          prepend-icon="mdi-chat"
          title="Back to Chat"
          value="chat"
          rounded="lg"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <div class="admin-main-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const drawer = ref(true)

const user = computed(() => authStore.user)

const handleLogout = () => {
  authStore.logout()
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

.admin-main-content {
  margin-top: 64px;
  margin-left: 280px;
  width: calc(100% - 280px);
  min-height: calc(100vh - 64px);
}

@media (max-width: 960px) {
  .admin-main-content {
    margin-left: 0;
    width: 100%;
  }
}

:deep(.v-app-bar) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

:deep(.v-navigation-drawer) {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item {
  margin-bottom: 4px;
}

.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
</style>
