<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card max-width="600" width="100%" elevation="8">
      <v-card-title class="text-h4 font-weight-bold text-center pa-6 bg-primary">
        Hotel Registration
      </v-card-title>

      <v-card-text class="pa-6">
        <!-- Step indicator -->
        <v-stepper v-model="step" alt-labels class="mb-6">
          <v-stepper-header>
            <v-stepper-item :complete="step > 1" :value="1" title="Hotel Details"></v-stepper-item>
            <v-divider></v-divider>
            <v-stepper-item :complete="step > 2" :value="2" title="API Key"></v-stepper-item>
            <v-divider></v-divider>
            <v-stepper-item :value="3" title="Confirmation"></v-stepper-item>
          </v-stepper-header>
        </v-stepper>

        <!-- Error alert -->
        <v-alert v-if="error" type="error" dismissible @click:close="error = null" class="mb-4">
          {{ error }}
        </v-alert>

        <!-- Success alert -->
        <v-alert v-if="success" type="success" class="mb-4">
          {{ success }}
        </v-alert>

        <!-- Step 1: Hotel Details -->
        <v-window v-model="step">
          <v-window-item :value="1">
            <v-form ref="hotelDetailsForm" v-model="validHotelDetails">
              <v-text-field
                v-model="hotelName"
                label="Hotel Name"
                :rules="[rules.required]"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-domain"
              ></v-text-field>

              <v-text-field
                v-model="contactEmail"
                label="Contact Email"
                type="email"
                :rules="[rules.required, rules.email]"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-email"
              ></v-text-field>

              <v-text-field
                v-model="contactPhone"
                label="Contact Phone (optional)"
                type="tel"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-phone"
              ></v-text-field>

              <v-textarea
                v-model="address"
                label="Hotel Address (optional)"
                variant="outlined"
                rows="3"
                class="mb-4"
                prepend-inner-icon="mdi-map-marker"
              ></v-textarea>

              <v-text-field
                v-model="password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                :rules="[rules.required, rules.minLength(8)]"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPassword = !showPassword"
                hint="Minimum 8 characters"
                persistent-hint
              ></v-text-field>

              <v-text-field
                v-model="passwordConfirm"
                label="Confirm Password"
                :type="showPasswordConfirm ? 'text' : 'password'"
                :rules="[rules.required, rules.passwordMatch]"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-lock-check"
                :append-inner-icon="showPasswordConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showPasswordConfirm = !showPasswordConfirm"
              ></v-text-field>
            </v-form>
          </v-window-item>

          <!-- Step 2: API Key -->
          <v-window-item :value="2">
            <v-form ref="apiKeyForm" v-model="validApiKey">
              <v-alert type="info" class="mb-4">
                Your Quendoo API key is used to connect your hotel's booking system.
                It will be securely encrypted and stored on our servers. You will never need to enter it again.
              </v-alert>

              <v-text-field
                v-model="quendooApiKey"
                label="Quendoo API Key"
                :type="showApiKey ? 'text' : 'password'"
                :rules="[rules.required, rules.minLength(10)]"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-key"
                :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showApiKey = !showApiKey"
              ></v-text-field>

              <v-alert type="warning" variant="tonal" class="mb-4">
                <strong>Security:</strong> Your API key will be encrypted using AES-256 and stored in Google Secret Manager.
                It will never be visible in your browser or logs.
              </v-alert>

              <v-divider class="my-6"></v-divider>

              <h4 class="text-h6 mb-4">AI Assistant Settings</h4>

              <v-select
                v-model="language"
                :items="languages"
                item-title="label"
                item-value="value"
                label="Response Language"
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-translate"
                hint="Language for AI assistant responses"
                persistent-hint
              ></v-select>

              <v-textarea
                v-model="customPrompt"
                label="Custom Instructions (optional)"
                variant="outlined"
                rows="4"
                class="mb-4"
                prepend-inner-icon="mdi-text"
                hint="Add specific instructions for your hotel. Example: 'Always mention our SPA center'"
                persistent-hint
                counter="2000"
                :rules="[rules.maxLength(2000)]"
              ></v-textarea>

              <v-divider class="my-6"></v-divider>

              <v-checkbox
                v-model="termsAccepted"
                :rules="[rules.required]"
                class="mb-0"
              >
                <template v-slot:label>
                  <div>
                    I accept the
                    <a href="#" @click.prevent="showTerms = true">Terms and Conditions</a>
                    and
                    <a href="#" @click.prevent="showPrivacy = true">Privacy Policy</a>
                  </div>
                </template>
              </v-checkbox>
            </v-form>
          </v-window-item>

          <!-- Step 3: Confirmation -->
          <v-window-item :value="3">
            <v-card variant="flat" class="bg-grey-lighten-5 pa-4">
              <h3 class="text-h6 mb-4">Review Your Information</h3>

              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-domain</v-icon>
                  </template>
                  <v-list-item-title>Hotel Name</v-list-item-title>
                  <v-list-item-subtitle>{{ hotelName }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-email</v-icon>
                  </template>
                  <v-list-item-title>Contact Email</v-list-item-title>
                  <v-list-item-subtitle>{{ contactEmail }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="contactPhone">
                  <template v-slot:prepend>
                    <v-icon>mdi-phone</v-icon>
                  </template>
                  <v-list-item-title>Contact Phone</v-list-item-title>
                  <v-list-item-subtitle>{{ contactPhone }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="address">
                  <template v-slot:prepend>
                    <v-icon>mdi-map-marker</v-icon>
                  </template>
                  <v-list-item-title>Address</v-list-item-title>
                  <v-list-item-subtitle>{{ address }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-key</v-icon>
                  </template>
                  <v-list-item-title>API Key</v-list-item-title>
                  <v-list-item-subtitle>••••••••••••{{ quendooApiKey.slice(-4) }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-translate</v-icon>
                  </template>
                  <v-list-item-title>Response Language</v-list-item-title>
                  <v-list-item-subtitle>{{ languages.find(l => l.value === language)?.label }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="customPrompt">
                  <template v-slot:prepend>
                    <v-icon>mdi-text</v-icon>
                  </template>
                  <v-list-item-title>Custom Instructions</v-list-item-title>
                  <v-list-item-subtitle>{{ customPrompt.substring(0, 100) }}{{ customPrompt.length > 100 ? '...' : '' }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card>

            <v-alert type="success" variant="tonal" class="mt-4">
              <strong>Ready to register!</strong> Click "Complete Registration" to create your hotel account.
            </v-alert>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions class="pa-6 pt-0">
        <v-btn
          v-if="step > 1"
          variant="text"
          @click="step--"
          :disabled="loading"
        >
          Back
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          v-if="step < 3"
          color="primary"
          variant="flat"
          @click="nextStep"
          :disabled="!canProceed"
        >
          Next
        </v-btn>
        <v-btn
          v-else
          color="success"
          variant="flat"
          @click="register"
          :loading="loading"
        >
          Complete Registration
        </v-btn>
      </v-card-actions>

      <v-divider></v-divider>

      <v-card-actions class="pa-4 justify-center">
        <div class="text-caption text-grey">
          Already have an account?
          <router-link to="/login" class="text-decoration-none">Sign in</router-link>
        </div>
      </v-card-actions>
    </v-card>

    <!-- Terms Dialog -->
    <v-dialog v-model="showTerms" max-width="800">
      <v-card>
        <v-card-title>Terms and Conditions</v-card-title>
        <v-card-text style="max-height: 400px; overflow-y: auto;">
          <h3>1. Acceptance of Terms</h3>
          <p>By using Quendoo AI Dashboard, you agree to these terms and conditions.</p>

          <h3>2. Service Description</h3>
          <p>Quendoo AI Dashboard provides AI-powered chatbot services for hotel booking inquiries.</p>

          <h3>3. API Key Security</h3>
          <p>Your Quendoo API key will be encrypted using AES-256 and stored securely in Google Secret Manager.
          We will never share your API key with third parties.</p>

          <h3>4. Data Usage</h3>
          <p>Conversation data is stored for service improvement and support purposes.
          We do not sell or share your data with third parties.</p>

          <h3>5. Limitation of Liability</h3>
          <p>The service is provided "as is" without warranties. We are not liable for any damages
          arising from the use of this service.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="showTerms = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Privacy Policy Dialog -->
    <v-dialog v-model="showPrivacy" max-width="800">
      <v-card>
        <v-card-title>Privacy Policy</v-card-title>
        <v-card-text style="max-height: 400px; overflow-y: auto;">
          <h3>1. Information Collection</h3>
          <p>We collect hotel information, contact details, and Quendoo API keys necessary for service operation.</p>

          <h3>2. Data Storage</h3>
          <p>All data is stored on Google Cloud Platform infrastructure with industry-standard encryption.</p>

          <h3>3. Data Security</h3>
          <p>Your API key is encrypted using AES-256 and stored in Google Secret Manager.
          Conversation data is stored in Firestore with access controls.</p>

          <h3>4. Data Access</h3>
          <p>Only authorized personnel can access your data for support and maintenance purposes.</p>

          <h3>5. Data Retention</h3>
          <p>We retain your data for the duration of your account and may retain backups for up to 30 days after deletion.</p>

          <h3>6. Your Rights</h3>
          <p>You have the right to access, modify, or delete your data. Contact us at support@quendoo.com for requests.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="showPrivacy = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();

// Form data
const step = ref(1);
const hotelName = ref('');
const contactEmail = ref('');
const contactPhone = ref('');
const address = ref('');
const password = ref('');
const passwordConfirm = ref('');
const quendooApiKey = ref('');
const language = ref('bg'); // Default to Bulgarian
const customPrompt = ref('');
const termsAccepted = ref(false);
const showApiKey = ref(false);
const showPassword = ref(false);
const showPasswordConfirm = ref(false);

// Language options
const languages = [
  { label: 'English', value: 'en' },
  { label: 'Български', value: 'bg' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Français', value: 'fr' },
  { label: 'Español', value: 'es' },
  { label: 'Italiano', value: 'it' },
  { label: 'Русский', value: 'ru' },
  { label: 'Македонски', value: 'mk' },
  { label: 'Română', value: 'ro' }
];

// UI state
const loading = ref(false);
const error = ref(null);
const success = ref(null);
const validHotelDetails = ref(false);
const validApiKey = ref(false);
const showTerms = ref(false);
const showPrivacy = ref(false);

// Form refs
const hotelDetailsForm = ref(null);
const apiKeyForm = ref(null);

// Validation rules
const rules = {
  required: value => !!value || 'Required',
  email: value => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(value) || 'Invalid email';
  },
  minLength: (min) => value => value.length >= min || `Must be at least ${min} characters`,
  maxLength: (max) => value => !value || value.length <= max || `Must be at most ${max} characters`,
  passwordMatch: value => value === password.value || 'Passwords do not match'
};

// Computed
const canProceed = computed(() => {
  if (step.value === 1) return validHotelDetails.value;
  if (step.value === 2) return validApiKey.value && termsAccepted.value;
  return true;
});

// Methods
const nextStep = async () => {
  if (step.value === 1) {
    const { valid } = await hotelDetailsForm.value.validate();
    if (valid) step.value++;
  } else if (step.value === 2) {
    const { valid } = await apiKeyForm.value.validate();
    if (valid && termsAccepted.value) step.value++;
  }
};

const register = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Get backend URL from environment
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

    // Call registration endpoint
    const response = await axios.post(`${backendUrl}/api/hotels/register`, {
      quendooApiKey: quendooApiKey.value,
      hotelName: hotelName.value,
      contactEmail: contactEmail.value,
      password: password.value,
      contactPhone: contactPhone.value,
      address: address.value,
      language: language.value,
      customPrompt: customPrompt.value
    });

    if (response.data.success) {
      // Store JWT token
      localStorage.setItem('hotelToken', response.data.hotelToken);
      localStorage.setItem('hotelId', response.data.hotelId);
      localStorage.setItem('hotelName', response.data.hotelName);

      // Show success message
      success.value = `Registration successful! Welcome, ${response.data.hotelName}`;

      // Redirect to chat after 2 seconds
      setTimeout(() => {
        router.push('/chat');
      }, 2000);
    } else {
      error.value = response.data.error || 'Registration failed';
    }
  } catch (err) {
    console.error('Registration error:', err);
    error.value = err.response?.data?.error || 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.v-card {
  border-radius: 16px;
}

.bg-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.v-stepper {
  box-shadow: none;
}

a {
  color: #667eea;
  text-decoration: underline;
}

a:hover {
  color: #764ba2;
}
</style>
