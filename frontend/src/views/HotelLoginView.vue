<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <img src="@/assets/quendoo-logo.svg" alt="Quendoo AI" class="logo" />
        <h1 class="title">Hotel Login</h1>
        <p class="subtitle">Sign in to your Quendoo AI dashboard</p>
      </div>

      <v-form @submit.prevent="handleLogin" class="login-form">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-email"
          :error-messages="emailError"
          required
          autofocus
          class="mb-4"
        />

        <v-text-field
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-lock"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
          :error-messages="passwordError"
          required
          class="mb-2"
        />

        <v-checkbox
          v-model="rememberMe"
          label="Запомни ме"
          color="primary"
          density="compact"
          hide-details
          class="mb-4"
        />

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          closable
          @click:close="errorMessage = ''"
          class="mb-4"
        >
          {{ errorMessage }}
        </v-alert>

        <v-btn
          type="submit"
          color="primary"
          size="large"
          block
          :loading="loading"
          :disabled="!isFormValid"
          class="login-btn"
        >
          Sign In
        </v-btn>

        <div class="register-link">
          <span>Don't have an account?</span>
          <v-btn
            variant="text"
            color="primary"
            @click="goToRegistration"
            size="small"
          >
            Register your hotel
          </v-btn>
        </div>
      </v-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/plugins/axios'

const router = useRouter()

// Form state
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(true) // Default to true for better UX
const loading = ref(false)
const errorMessage = ref('')
const emailError = ref('')
const passwordError = ref('')

// Computed
const isFormValid = computed(() => {
  return email.value.includes('@') && password.value.length >= 8
})

// Methods
const handleLogin = async () => {
  // Clear previous errors
  emailError.value = ''
  passwordError.value = ''
  errorMessage.value = ''

  // Validate
  if (!email.value.includes('@')) {
    emailError.value = 'Please enter a valid email'
    return
  }

  if (password.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters'
    return
  }

  loading.value = true

  try {
    const response = await api.post('/api/hotels/login', {
      email: email.value,
      password: password.value
    })

    if (response.data.success) {
      // Store authentication data
      localStorage.setItem('hotelToken', response.data.hotelToken)
      localStorage.setItem('hotelId', response.data.hotelId)
      localStorage.setItem('hotelName', response.data.hotelName)
      localStorage.setItem('hotelEmail', response.data.contactEmail)

      // Store remember me preference and login timestamp
      localStorage.setItem('rememberMe', rememberMe.value ? 'true' : 'false')
      localStorage.setItem('loginTimestamp', Date.now().toString())

      console.log('[Hotel Login] Login successful, redirecting to chat')

      // Redirect to chat
      router.push('/chat')
    } else {
      errorMessage.value = response.data.error || 'Login failed'
    }

  } catch (error) {
    console.error('[Hotel Login] Error:', error)

    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      if (status === 423) {
        // Account locked
        if (data.code === 'ACCOUNT_LOCKED') {
          const lockedUntil = new Date(data.lockedUntil)
          const now = new Date()
          const minutesRemaining = Math.ceil((lockedUntil - now) / 60000)

          errorMessage.value = `Акаунтът е временно заключен поради твърде много неуспешни опити за вход. Опитайте отново след ${minutesRemaining} минути.`
        } else {
          errorMessage.value = data.error || 'Account is temporarily locked'
        }
      } else if (status === 429) {
        // Rate limit exceeded
        const retryAfter = data.retryAfter || '15 минути'
        errorMessage.value = `Твърде много опити за вход. Моля, опитайте отново след ${retryAfter}.`
      } else if (status === 401) {
        // Invalid credentials
        const attemptsRemaining = data.attemptsRemaining
        if (attemptsRemaining !== undefined && attemptsRemaining > 0) {
          errorMessage.value = `Грешен email или парола. Остават ${attemptsRemaining} ${attemptsRemaining === 1 ? 'опит' : 'опита'}.`
        } else if (attemptsRemaining === 0) {
          errorMessage.value = 'Грешен email или парола. Това е последният Ви опит преди заключване на акаунта.'
        } else {
          errorMessage.value = 'Грешен email или парола.'
        }
      } else if (status === 403) {
        if (data.code === 'ACCOUNT_SUSPENDED') {
          errorMessage.value = 'Вашият акаунт е суспендиран. Моля, свържете се с поддръжката.'
        } else {
          errorMessage.value = 'Достъпът е отказан.'
        }
      } else {
        errorMessage.value = data?.error || 'Неуспешен вход. Моля, опитайте отново.'
      }
    } else if (error.request) {
      errorMessage.value = 'Няма връзка със сървъра. Моля, проверете интернет връзката си.'
    } else {
      errorMessage.value = 'Възникна неочаквана грешка. Моля, опитайте отново.'
    }
  } finally {
    loading.value = false
  }
}

const goToRegistration = () => {
  router.push('/register')
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 48px 40px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  width: 64px;
  height: 64px;
  margin-bottom: 24px;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
}

.subtitle {
  font-size: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
}

.login-form {
  margin-top: 32px;
}

.login-btn {
  margin-top: 8px;
  text-transform: none;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.5px;
}

.register-link {
  margin-top: 24px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.register-link span {
  margin-right: 4px;
}

@media (max-width: 600px) {
  .login-card {
    padding: 32px 24px;
  }

  .title {
    font-size: 1.75rem;
  }
}
</style>
