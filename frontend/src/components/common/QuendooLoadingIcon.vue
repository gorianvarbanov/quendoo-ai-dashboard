<template>
  <div class="quendoo-loading">
    <svg
      class="loading-icon"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Outer rotating ring -->
      <circle
        cx="50"
        cy="50"
        r="40"
        class="loading-ring outer-ring"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-dasharray="60 200"
        stroke-linecap="round"
      />

      <!-- Inner rotating ring -->
      <circle
        cx="50"
        cy="50"
        r="30"
        class="loading-ring inner-ring"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-dasharray="40 150"
        stroke-linecap="round"
      />

      <!-- Center pulsing dot -->
      <circle
        cx="50"
        cy="50"
        r="8"
        class="loading-dot"
        fill="currentColor"
      />
    </svg>
  </div>
</template>

<style scoped>
.quendoo-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  width: 48px;
  height: 48px;
  color: rgb(var(--v-theme-primary));
}

/* Outer ring rotates clockwise */
.outer-ring {
  animation: rotate-clockwise 2s linear infinite;
  opacity: 0.6;
}

/* Inner ring rotates counter-clockwise */
.inner-ring {
  animation: rotate-counter 1.5s linear infinite;
  opacity: 0.4;
}

/* Center dot pulses */
.loading-dot {
  animation: pulse-scale 1s ease-in-out infinite;
}

@keyframes rotate-clockwise {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes rotate-counter {
  0% {
    transform: rotate(360deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes pulse-scale {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
}
</style>
