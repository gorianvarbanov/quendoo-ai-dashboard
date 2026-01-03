<script setup>
import { useTheme } from 'vuetify'

const theme = useTheme()
</script>

<template>
  <v-app>
    <v-main class="main-container">
      <router-view />
    </v-main>
  </v-app>
</template>

<style>
#app {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.main-container {
  background: rgb(var(--v-theme-surface));
  min-height: 100vh;
  padding: 0 !important;
  margin: 0 !important;
}

.main-container :deep(.v-main__wrap) {
  padding: 0 !important;
  margin: 0 !important;
}

/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}
</style>
