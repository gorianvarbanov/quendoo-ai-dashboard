<template>
  <admin-layout>
    <div class="admin-content">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, {{ user?.username || 'Admin' }}</p>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon-container success">
            <v-icon size="24">mdi-check-circle</v-icon>
          </div>
          <div class="stat-details">
            <div class="stat-label">API Status</div>
            <div class="stat-value">{{ apiStatus }}</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon-container primary">
            <v-icon size="24">mdi-shield-check</v-icon>
          </div>
          <div class="stat-details">
            <div class="stat-label">Security Status</div>
            <div class="stat-value">Active</div>
          </div>
        </div>

        <div class="stat-item">
          <div class="stat-icon-container info">
            <v-icon size="24">mdi-message-text</v-icon>
          </div>
          <div class="stat-details">
            <div class="stat-label">System Prompt</div>
            <div class="stat-value">v1.0</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Quick Actions</h2>
        </div>
        <div class="actions-grid">
          <div class="action-item" @click="goToSettings">
            <v-icon size="20" class="action-icon">mdi-cog</v-icon>
            <span class="action-label">Manage Settings</span>
            <v-icon size="16" class="action-arrow">mdi-chevron-right</v-icon>
          </div>
          <div class="action-item" @click="goToSecurity">
            <v-icon size="20" class="action-icon">mdi-security</v-icon>
            <span class="action-label">Security Monitor</span>
            <v-icon size="16" class="action-arrow">mdi-chevron-right</v-icon>
          </div>
          <div class="action-item" @click="goToSecurityConfig">
            <v-icon size="20" class="action-icon">mdi-shield-cog</v-icon>
            <span class="action-label">Security Configuration</span>
            <v-icon size="16" class="action-arrow">mdi-chevron-right</v-icon>
          </div>
        </div>
      </div>
    </div>
  </admin-layout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import AdminLayout from './AdminLayout.vue'

const router = useRouter()
const authStore = useAuthStore()

const apiStatus = ref('Connected')

const user = computed(() => authStore.user)

const goToSettings = () => {
  router.push('/admin/settings')
}

const goToSecurity = () => {
  router.push('/admin/security')
}

const goToSecurityConfig = () => {
  router.push('/admin/security-config')
}

onMounted(() => {
  // Could fetch stats here
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
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  margin-left: -24px;
  margin-right: -24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  background: rgb(var(--v-theme-surface));
  transition: background-color 0.15s ease;
}

.stat-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.stat-icon-container {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-container.success {
  background: rgba(var(--v-theme-success), 0.1);
  color: rgb(var(--v-theme-success));
}

.stat-icon-container.primary {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.stat-icon-container.info {
  background: rgba(var(--v-theme-info), 0.1);
  color: rgb(var(--v-theme-info));
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

/* Section */
.section {
  padding: 0;
  margin-top: 24px;
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

/* Actions Grid */
.actions-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}

.action-icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.action-label {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.action-arrow {
  color: rgba(var(--v-theme-on-surface), 0.4);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .page-header,
  .section {
    padding: 16px;
  }
}
</style>
