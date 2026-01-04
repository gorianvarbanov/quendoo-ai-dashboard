<template>
  <div class="admin-login-container">
    <v-card class="login-card" elevation="8">
      <v-card-title class="text-h5 text-center pa-6">
        <v-icon size="large" class="mr-2">mdi-shield-lock</v-icon>
        Quendoo Admin
      </v-card-title>

      <v-card-text class="pa-6">
        <v-form @submit.prevent="handleLogin">
          <v-text-field
            v-model="username"
            label="Username"
            prepend-inner-icon="mdi-account"
            variant="outlined"
            :disabled="isLoading"
            :error-messages="error && !username ? [error] : []"
            @input="clearError"
            class="mb-4"
            density="comfortable"
          />

          <v-text-field
            v-model="password"
            label="Password"
            type="password"
            prepend-inner-icon="mdi-lock"
            variant="outlined"
            :disabled="isLoading"
            :error-messages="error && password ? [error] : []"
            @input="clearError"
            class="mb-6"
            density="comfortable"
          />

          <v-btn
            type="submit"
            color="primary"
            block
            size="large"
            :loading="isLoading"
            :disabled="!username || !password"
          >
            <v-icon left class="mr-2">mdi-login</v-icon>
            Sign In
          </v-btn>
        </v-form>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          closable
          @click:close="clearError"
        >
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions class="pa-6 pt-0">
        <v-spacer />
        <v-btn
          color="grey"
          variant="text"
          @click="goToChat"
        >
          <v-icon left class="mr-1">mdi-arrow-left</v-icon>
          Back to Chat
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref(null)

const handleLogin = async () => {
  isLoading.value = true
  error.value = null

  const result = await authStore.login(username.value, password.value)

  if (result.success) {
    // Redirect to admin dashboard on successful login
    router.push('/admin')
  } else {
    error.value = result.error || 'Login failed. Please check your credentials.'
  }

  isLoading.value = false
}

const clearError = () => {
  error.value = null
  authStore.clearError()
}

const goToChat = () => {
  router.push('/')
}
</script>

<style scoped>
.admin-login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 450px;
  border-radius: 16px;
}

.v-card-title {
  color: #1976d2;
  border-radius: 16px 16px 0 0;
}
</style>
