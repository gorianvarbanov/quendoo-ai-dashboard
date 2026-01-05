<template>
  <v-dialog v-model="isOpen" max-width="900px" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-h5">{{ title }}</span>
        <v-btn icon variant="text" @click="isOpen = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <v-carousel
          v-if="images.length > 0"
          height="500"
          :show-arrows="images.length > 1"
          hide-delimiter-background
          cycle
          interval="4000"
        >
          <v-carousel-item
            v-for="(image, index) in images"
            :key="index"
            :src="image.url"
            cover
          >
            <template v-slot:placeholder>
              <v-row class="fill-height ma-0" align="center" justify="center">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </v-row>
            </template>

            <div class="image-overlay">
              <div class="image-caption">
                <h3>{{ image.roomName }}</h3>
                <p v-if="image.description">{{ image.description }}</p>
              </div>
            </div>
          </v-carousel-item>
        </v-carousel>

        <div v-else class="no-images pa-8 text-center">
          <v-icon size="64" color="grey">mdi-image-off</v-icon>
          <p class="text-h6 mt-4">No images available</p>
        </div>
      </v-card-text>

      <v-card-actions class="justify-end pa-4">
        <v-btn color="primary" variant="text" @click="isOpen = false">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Room Gallery'
  },
  images: {
    type: Array,
    default: () => []
    // Expected format: [{ url: string, roomName: string, description?: string }]
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal
})

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal)
})
</script>

<style scoped>
.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
  padding: 32px 24px 24px;
  color: white;
}

.image-caption h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.image-caption p {
  font-size: 0.95rem;
  opacity: 0.95;
  line-height: 1.4;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  margin: 0;
}

.no-images {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
