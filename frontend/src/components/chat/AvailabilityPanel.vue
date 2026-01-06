<template>
  <v-navigation-drawer
    v-if="props.modelValue"
    v-model="isOpen"
    location="right"
    temporary
    width="90%"
    class="availability-panel"
  >
    <div class="panel-header">
      <h3 class="panel-title">
        <v-icon color="primary" class="mr-2">mdi-calendar-check</v-icon>
        Room Availability
      </h3>
      <v-btn
        icon
        variant="text"
        size="small"
        @click="close"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <div v-if="availabilityData" class="panel-content">
      <!-- Date Range Info -->
      <div class="date-range-info">
        <v-chip color="primary" variant="outlined">
          {{ formatDate(availabilityData.date_from) }} - {{ formatDate(availabilityData.date_to) }}
        </v-chip>
        <v-chip color="secondary" variant="outlined" class="ml-2">
          {{ availabilityData.days.length }} days
        </v-chip>
      </div>

      <!-- Availability Calendar Grid -->
      <div class="availability-calendar">
        <!-- Header Row with Dates -->
        <div class="calendar-header">
          <div class="room-label-header">Rooms and qtys</div>
          <div
            v-for="day in availabilityData.days"
            :key="day.date"
            class="calendar-date-cell"
          >
            <div class="date-number">{{ getDayNumber(day.date) }}</div>
            <div class="date-weekday">{{ getWeekday(day.date) }}</div>
          </div>
        </div>

        <!-- Room Rows -->
        <div
          v-for="room in availabilityData.rooms"
          :key="room.room_id"
          class="room-row"
        >
          <!-- Room Name Column -->
          <div class="room-label">
            {{ room.room_name }}
          </div>

          <!-- Active/Inactive Row -->
          <div class="room-subrow">
            <div class="subrow-label">Active/Inactive</div>
            <div
              v-for="day in room.availability"
              :key="`active-${room.room_id}-${day.date}`"
              class="calendar-cell"
              :class="{ 'cell-active': day.is_opened, 'cell-inactive': !day.is_opened }"
            >
              <v-icon size="14" :color="day.is_opened ? 'success' : 'error'">
                {{ day.is_opened ? 'mdi-check' : 'mdi-close' }}
              </v-icon>
            </div>
          </div>

          <!-- Available Quantity Row -->
          <div class="room-subrow">
            <div class="subrow-label">Available qty</div>
            <div
              v-for="day in room.availability"
              :key="`qty-${room.room_id}-${day.date}`"
              class="calendar-cell qty-cell"
              :class="{ 'qty-low': day.qty < 3, 'qty-zero': day.qty === 0 }"
            >
              {{ day.qty }}
            </div>
          </div>
        </div>

        <!-- Total Available Row -->
        <div class="total-row">
          <div class="room-label total-label">Total available qty</div>
          <div
            v-for="day in availabilityData.days"
            :key="`total-${day.date}`"
            class="calendar-cell total-cell"
          >
            {{ calculateTotalForDay(day.date) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="panel-empty">
      <v-icon size="64" color="grey-lighten-1">mdi-calendar-blank</v-icon>
      <p class="empty-text">No availability data</p>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  rawData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Parse raw availability data into structured format
const availabilityData = computed(() => {
  if (!props.rawData) return null

  console.log('[AvailabilityPanel] Raw data received:', JSON.stringify(props.rawData, null, 2))

  try {
    // Handle different possible data structures
    let actualData = props.rawData

    // If data is nested in a 'data' or 'result' property
    if (props.rawData.data) {
      actualData = props.rawData.data
      console.log('[AvailabilityPanel] Found nested data:', JSON.stringify(actualData, null, 2))
    } else if (props.rawData.result) {
      actualData = props.rawData.result
      console.log('[AvailabilityPanel] Found nested result:', JSON.stringify(actualData, null, 2))
    }

    const date_from = actualData.date_from
    const date_to = actualData.date_to

    const datesSet = new Set()
    const roomsMap = new Map()

    // Check for availability array
    const availabilityArray = actualData.availability || actualData.rooms || []
    console.log('[AvailabilityPanel] Availability array length:', availabilityArray.length)

    if (Array.isArray(availabilityArray) && availabilityArray.length > 0) {
      availabilityArray.forEach(entry => {
        datesSet.add(entry.date)

        if (!roomsMap.has(entry.room_id)) {
          roomsMap.set(entry.room_id, {
            room_id: entry.room_id,
            room_name: entry.room_name || `Room ${entry.room_id}`,
            availability: []
          })
        }

        roomsMap.get(entry.room_id).availability.push({
          date: entry.date,
          qty: entry.qty || 0,
          is_opened: entry.is_opened === 1 || entry.is_opened === true
        })
      })
    }

    const sortedDates = Array.from(datesSet).sort()

    console.log('[AvailabilityPanel] Parsed data - Days:', sortedDates.length, 'Rooms:', roomsMap.size)

    return {
      date_from,
      date_to,
      days: sortedDates.map(date => ({ date })),
      rooms: Array.from(roomsMap.values())
    }
  } catch (error) {
    console.error('[AvailabilityPanel] Error parsing data:', error)
    return null
  }
})

function close() {
  isOpen.value = false
}

// Native JavaScript date formatting
function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  } catch {
    return dateStr
  }
}

function getDayNumber(dateStr) {
  try {
    const date = new Date(dateStr)
    return date.getDate().toString()
  } catch {
    return ''
  }
}

function getWeekday(dateStr) {
  try {
    const date = new Date(dateStr)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return weekdays[date.getDay()]
  } catch {
    return ''
  }
}

function calculateTotalForDay(date) {
  if (!availabilityData.value) return 0

  let total = 0
  availabilityData.value.rooms.forEach(room => {
    const dayData = room.availability.find(a => a.date === date)
    if (dayData && dayData.is_opened) {
      total += dayData.qty
    }
  })
  return total
}
</script>

<style scoped>
.availability-panel {
  background: rgb(var(--v-theme-surface));
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-background));
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  align-items: center;
  margin: 0;
}

.panel-content {
  padding: 20px;
  overflow-x: auto;
}

.date-range-info {
  margin-bottom: 20px;
}

.availability-calendar {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.calendar-header {
  display: grid;
  grid-template-columns: 200px repeat(auto-fit, minmax(70px, 1fr));
  background: rgba(var(--v-theme-primary), 0.08);
  border-bottom: 2px solid rgba(var(--v-theme-on-surface), 0.12);
}

.room-label-header {
  padding: 12px;
  font-weight: 600;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-primary), 0.12);
}

.calendar-date-cell {
  padding: 8px;
  text-align: center;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.calendar-date-cell:last-child {
  border-right: none;
}

.date-number {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.date-weekday {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-transform: uppercase;
}

.room-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.room-row:last-child {
  border-bottom: none;
}

.room-label {
  padding: 12px;
  font-weight: 600;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-surface), 0.5);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.room-subrow {
  display: grid;
  grid-template-columns: 200px repeat(auto-fit, minmax(70px, 1fr));
  align-items: center;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.room-subrow:last-child {
  border-bottom: none;
}

.subrow-label {
  padding: 8px 12px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-surface), 0.3);
}

.calendar-cell {
  padding: 8px;
  text-align: center;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: white;
}

.calendar-cell:last-child {
  border-right: none;
}

.cell-active {
  background: rgba(var(--v-theme-success), 0.08);
}

.cell-inactive {
  background: rgba(var(--v-theme-error), 0.05);
}

.qty-cell {
  font-weight: 500;
  font-size: 0.9375rem;
  color: rgb(var(--v-theme-on-surface));
}

.qty-low {
  background: rgba(var(--v-theme-warning), 0.1);
  color: rgb(var(--v-theme-warning));
  font-weight: 600;
}

.qty-zero {
  background: rgba(var(--v-theme-error), 0.1);
  color: rgb(var(--v-theme-error));
  font-weight: 600;
}

.total-row {
  display: grid;
  grid-template-columns: 200px repeat(auto-fit, minmax(70px, 1fr));
  background: rgba(var(--v-theme-primary), 0.05);
  border-top: 2px solid rgba(var(--v-theme-on-surface), 0.12);
}

.total-label {
  background: rgba(var(--v-theme-primary), 0.1);
  font-weight: 600;
  border-bottom: none;
}

.total-cell {
  font-weight: 600;
  font-size: 1rem;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
}

.empty-text {
  font-size: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 0;
}
</style>
