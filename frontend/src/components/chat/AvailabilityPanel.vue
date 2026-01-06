<template>
  <v-navigation-drawer
    v-if="props.modelValue"
    v-model="isOpen"
    location="right"
    temporary
    width="800px"
    class="availability-panel"
  >
    <div class="panel-header">
      <div>
        <h3 class="panel-title">
          <v-icon color="primary" class="mr-2">mdi-calendar-check</v-icon>
          Наличности по стаи
        </h3>
        <div v-if="availabilityData" class="date-range-subtitle">
          {{ formatDateRange(availabilityData.date_from, availabilityData.date_to) }}
        </div>
      </div>
      <v-btn
        icon
        variant="text"
        size="small"
        @click="close"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <div v-if="availabilityData && availabilityData.rooms && availabilityData.rooms.length > 0" class="panel-content">
      <!-- Simple Table Format -->
      <div class="availability-table-container">
        <table class="availability-table-full">
          <thead>
            <tr>
              <th class="sticky-col">Стая</th>
              <th
                v-for="day in availabilityData.days"
                :key="day.date"
                class="date-header"
              >
                <div class="date-col-header">
                  <div class="date-number">{{ getDayNumber(day.date) }}</div>
                  <div class="date-weekday">{{ getWeekday(day.date) }}</div>
                  <div class="date-month">{{ getMonth(day.date) }}</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="room in availabilityData.rooms"
              :key="room.room_id"
              class="room-data-row"
            >
              <td class="sticky-col room-name-cell">
                {{ room.room_name }}
              </td>
              <td
                v-for="dayData in room.availability"
                :key="dayData.date"
                class="qty-cell-full"
                :class="getQtyCellClass(dayData.qty, dayData.is_opened)"
              >
                <div class="qty-display">
                  {{ dayData.qty }}
                </div>
              </td>
            </tr>
            <!-- Total Row -->
            <tr class="total-row-full">
              <td class="sticky-col total-label-cell">
                <strong>Общо</strong>
              </td>
              <td
                v-for="day in availabilityData.days"
                :key="`total-${day.date}`"
                class="total-cell-full"
              >
                <strong>{{ calculateTotalForDay(day.date) }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="panel-content empty-state">
      <v-icon size="64" color="grey">mdi-calendar-remove</v-icon>
      <p class="mt-4 text-grey">Няма данни за наличности</p>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
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

  console.log('[AvailabilityPanel] Raw data:', props.rawData)

  try {
    // Data comes in format: {availability: [...], date_from, date_to}
    const data = props.rawData

    if (!data.availability || !Array.isArray(data.availability)) {
      console.warn('[AvailabilityPanel] No availability array found')
      return null
    }

    const date_from = data.date_from
    const date_to = data.date_to

    // Group by room and collect dates
    const roomsMap = new Map()
    const datesSet = new Set()

    data.availability.forEach(entry => {
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
        is_opened: entry.is_opened === true
      })
    })

    // Sort dates
    const sortedDates = Array.from(datesSet).sort()

    // Sort each room's availability by date
    roomsMap.forEach(room => {
      room.availability.sort((a, b) => a.date.localeCompare(b.date))
    })

    const result = {
      date_from,
      date_to,
      days: sortedDates.map(date => ({ date })),
      rooms: Array.from(roomsMap.values())
    }

    console.log('[AvailabilityPanel] Parsed:', result.rooms.length, 'rooms,', result.days.length, 'days')

    return result
  } catch (error) {
    console.error('[AvailabilityPanel] Error parsing data:', error)
    return null
  }
})

function close() {
  isOpen.value = false
}

function formatDateRange(from, to) {
  if (!from || !to) return ''
  const months = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
  try {
    const dateFrom = new Date(from)
    const dateTo = new Date(to)
    const monthName = months[dateFrom.getMonth()]
    return `${dateFrom.getDate()} - ${dateTo.getDate()} ${monthName} ${dateFrom.getFullYear()}`
  } catch {
    return `${from} - ${to}`
  }
}

function getDayNumber(dateStr) {
  try {
    return new Date(dateStr).getDate()
  } catch {
    return '?'
  }
}

function getWeekday(dateStr) {
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  try {
    return weekdays[new Date(dateStr).getDay()]
  } catch {
    return ''
  }
}

function getMonth(dateStr) {
  const months = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']
  try {
    return months[new Date(dateStr).getMonth()]
  } catch {
    return ''
  }
}

function getQtyCellClass(qty, isOpened) {
  if (!isOpened || qty === 0) return 'qty-zero'
  if (qty < 3) return 'qty-low'
  return 'qty-normal'
}

function calculateTotalForDay(date) {
  if (!availabilityData.value) return 0
  let total = 0
  availabilityData.value.rooms.forEach(room => {
    const dayData = room.availability.find(d => d.date === date)
    if (dayData && dayData.is_opened) {
      total += dayData.qty
    }
  })
  return total
}

// Watch for data changes
watch(() => props.rawData, (newData) => {
  console.log('[AvailabilityPanel] Data changed:', newData)
}, { deep: true })
</script>

<style scoped>
.availability-panel {
  z-index: 2000;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  margin: 0;
}

.date-range-subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.panel-content {
  padding: 20px;
  height: calc(100vh - 100px);
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.availability-table-container {
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.availability-table-full {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
}

.availability-table-full thead {
  background: #1976d2;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.availability-table-full th {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  font-size: 12px;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 60px;
}

.availability-table-full th.sticky-col {
  position: sticky;
  left: 0;
  z-index: 20;
  background: #1565c0;
  min-width: 150px;
  text-align: left;
}

.date-col-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.date-number {
  font-size: 16px;
  font-weight: 700;
}

.date-weekday {
  font-size: 10px;
  opacity: 0.8;
}

.date-month {
  font-size: 10px;
  opacity: 0.7;
}

.availability-table-full tbody tr {
  border-bottom: 1px solid #e0e0e0;
}

.availability-table-full tbody tr:hover {
  background: #f5f5f5;
}

.availability-table-full td {
  padding: 10px 8px;
  text-align: center;
  border-right: 1px solid #e0e0e0;
}

.availability-table-full td.sticky-col {
  position: sticky;
  left: 0;
  background: white;
  font-weight: 500;
  text-align: left;
  padding-left: 16px;
  z-index: 5;
  border-right: 2px solid #e0e0e0;
}

.availability-table-full tbody tr:hover td.sticky-col {
  background: #f5f5f5;
}

.room-name-cell {
  font-size: 14px;
}

.qty-cell-full {
  font-weight: 600;
  font-size: 14px;
}

.qty-display {
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  min-width: 30px;
}

.qty-zero {
  background: #f5f5f5;
  color: #999;
}

.qty-zero .qty-display {
  background: #e0e0e0;
}

.qty-low {
  background: #fff3cd;
  color: #856404;
}

.qty-low .qty-display {
  background: #ffc107;
  color: white;
}

.qty-normal {
  background: #d4edda;
  color: #155724;
}

.qty-normal .qty-display {
  background: #4caf50;
  color: white;
}

.total-row-full {
  background: #f5f5f5;
  font-weight: 700;
}

.total-row-full td {
  padding: 12px 8px;
  border-top: 2px solid #1976d2;
}

.total-label-cell {
  background: #f5f5f5 !important;
  color: #1976d2;
}

.total-cell-full {
  background: #e3f2fd;
  color: #1565c0;
  font-size: 15px;
}
</style>
