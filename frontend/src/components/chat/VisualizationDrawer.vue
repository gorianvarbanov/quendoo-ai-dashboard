<template>
  <v-navigation-drawer
    v-model="isOpen"
    location="right"
    temporary
    width="600"
    class="visualization-drawer"
  >
    <div class="drawer-header">
      <div class="drawer-title-section">
        <v-icon size="24" color="primary">mdi-chart-box-outline</v-icon>
        <h2 class="drawer-title">{{ drawerTitle }}</h2>
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

    <div class="drawer-content">
      <!-- Room Details Display -->
      <div v-if="visualizationType === 'room_details' && visualizationData" class="room-details-display">
        <div v-if="visualizationData.data && visualizationData.data.length > 0" class="rooms-grid">
          <div
            v-for="(room, index) in visualizationData.data"
            :key="room.id"
            class="room-card"
          >
            <!-- Room Image -->
            <div v-if="room.images && room.images.length > 0" class="room-image-container">
              <img :src="room.images[0]" :alt="room.name" class="room-image" />
            </div>

            <!-- Room Info -->
            <div class="room-info-container">
              <h3 class="room-name">{{ index + 1 }}. {{ room.name }}</h3>
              <div class="room-type">{{ room.type_name }}</div>

              <div class="room-specs">
                <div class="room-spec-item">
                  <v-icon size="16" color="grey-darken-1">mdi-vector-square</v-icon>
                  <span>{{ room.sqm_area }} кв.м</span>
                </div>
                <div class="room-spec-item">
                  <v-icon size="16" color="grey-darken-1">mdi-bed</v-icon>
                  <span>{{ room.regular_beds }} легла</span>
                  <span v-if="room.extra_beds > 0"> + {{ room.extra_beds }} доп.</span>
                </div>
              </div>

              <p class="room-description">{{ room.description }}</p>

              <!-- View Gallery Button -->
              <v-btn
                v-if="room.images && room.images.length > 1"
                size="small"
                variant="text"
                prepend-icon="mdi-image-multiple"
                @click="openRoomGallery(room)"
              >
                Виж галерия ({{ room.images.length }} снимки)
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking Offers Display -->
      <div v-if="visualizationType === 'booking_offers' && visualizationData" class="booking-offers-display">
        <div v-if="visualizationData.data && visualizationData.data.length > 0" class="offers-grid">
          <div
            v-for="(offer, index) in visualizationData.data"
            :key="index"
            class="offer-card"
          >
            <!-- Offer Info -->
            <div class="offer-info-container">
              <h3 class="offer-room-name">{{ index + 1 }}. {{ offer.room_name || offer.name }}</h3>
              <div class="offer-rate-name">{{ offer.rate_name || 'Стандартна тарифа' }}</div>

              <!-- Price Section -->
              <div class="offer-price-section">
                <div class="offer-total-price">
                  {{ offer.total_price || offer.price }} {{ offer.currency || 'лв' }}
                </div>
                <div v-if="offer.price_per_night" class="offer-price-per-night">
                  ({{ offer.price_per_night }} {{ offer.currency || 'лв' }}/нощ)
                </div>
              </div>

              <!-- Offer Details -->
              <div class="offer-details">
                <div v-if="offer.available_rooms" class="offer-detail-item">
                  <v-icon size="16" color="success">mdi-check-circle</v-icon>
                  <span>Налични стаи: {{ offer.available_rooms }}</span>
                </div>
                <div v-if="offer.meals_included" class="offer-detail-item">
                  <v-icon size="16" color="grey-darken-1">mdi-silverware-fork-knife</v-icon>
                  <span>{{ offer.meals_included }}</span>
                </div>
                <div v-if="offer.cancellation_policy" class="offer-detail-item">
                  <v-icon size="16" color="grey-darken-1">mdi-information</v-icon>
                  <span>{{ offer.cancellation_policy }}</span>
                </div>
              </div>

              <!-- Book Button -->
              <v-btn
                size="small"
                color="primary"
                variant="flat"
                prepend-icon="mdi-calendar-check"
                class="mt-2"
              >
                Резервирай
              </v-btn>
            </div>
          </div>
        </div>

        <div v-else class="no-data-message">
          Няма налични оферти за избрания период.
        </div>
      </div>

      <!-- Availability Summary Table -->
      <div v-if="visualizationType === 'availability' && visualizationData" class="availability-summary">
        <div class="availability-table-wrapper">
          <table class="availability-table">
            <thead>
              <tr>
                <th class="table-header-cell">Дата</th>
                <th
                  v-for="room in visualizationData.rooms"
                  :key="room.room_id"
                  class="table-header-cell room-header"
                >
                  {{ room.room_name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(dateRange, index) in getDateRangesForTable(visualizationData.rooms)"
                :key="index"
                class="table-row"
              >
                <td class="table-cell date-cell">{{ dateRange.dateLabel }}</td>
                <td
                  v-for="room in visualizationData.rooms"
                  :key="room.room_id"
                  class="table-cell qty-cell"
                  :class="getQtyCellClass(dateRange.dateRange, room)"
                >
                  {{ getQtyForDateRange(dateRange.dateRange, room) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bookings Summary Table -->
      <div v-if="visualizationType === 'bookings' && visualizationData" class="bookings-summary">
        <div class="bookings-table-wrapper">
          <table class="bookings-table">
            <thead>
              <tr>
                <th class="table-header-cell">ID</th>
                <th class="table-header-cell">Дати</th>
                <th class="table-header-cell">Стая</th>
                <th class="table-header-cell">Гости</th>
                <th class="table-header-cell">Клиент</th>
                <th class="table-header-cell">Статус</th>
                <th class="table-header-cell">Сума</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in visualizationData" :key="booking.booking_id" class="table-row">
                <td class="table-cell booking-id-cell">
                  <strong>#{{ booking.booking_id }}</strong>
                </td>
                <td class="table-cell date-cell">
                  <div class="date-range">
                    <div>{{ formatBookingDate(booking.checkin_date) }}</div>
                    <div class="date-separator">→</div>
                    <div>{{ formatBookingDate(booking.checkout_date) }}</div>
                  </div>
                </td>
                <td class="table-cell room-cell">
                  <div v-for="(room, idx) in booking.rooms" :key="idx" class="room-info">
                    {{ room.room_name }}
                  </div>
                </td>
                <td class="table-cell guests-cell">
                  <div v-for="(room, idx) in booking.rooms" :key="idx" class="guests-info">
                    <v-icon size="14">mdi-account</v-icon> {{ room.adults }}
                    <v-icon v-if="room.children > 0" size="14" class="ml-1">mdi-account-child</v-icon>
                    <span v-if="room.children > 0">{{ room.children }}</span>
                  </div>
                </td>
                <td class="table-cell client-cell">
                  <div class="client-name">{{ booking.client_name }}</div>
                  <div class="client-email">{{ booking.client_email }}</div>
                </td>
                <td class="table-cell status-cell">
                  <v-chip
                    size="small"
                    :color="getBookingStatusColor(booking.status)"
                    variant="flat"
                  >
                    {{ getBookingStatusLabel(booking.status) }}
                  </v-chip>
                  <v-chip
                    size="small"
                    :color="getPaymentStatusColor(booking.payment_status)"
                    variant="outlined"
                    class="mt-1"
                  >
                    {{ getPaymentStatusLabel(booking.payment_status) }}
                  </v-chip>
                </td>
                <td class="table-cell amount-cell">
                  <strong>{{ booking.total_amount }} {{ booking.currency }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="visualizationData.length > 10" class="bookings-footer">
          <v-chip size="small" color="grey" variant="outlined">
            Показани първите 10 от {{ visualizationData.length }} резервации
          </v-chip>
        </div>
      </div>

      <!-- Excel Results Table -->
      <div v-if="visualizationType === 'excel_results' && visualizationData" class="excel-results-summary">
        <div class="excel-table-wrapper">
          <table class="excel-table">
            <thead>
              <tr>
                <th v-for="(value, key) in visualizationData[0]" :key="key" class="table-header-cell">
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in visualizationData.slice(0, 50)" :key="idx" class="table-row">
                <td v-for="(value, key) in row" :key="key" class="table-cell">
                  {{ formatExcelCellValue(value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="visualizationData.length > 50" class="excel-footer">
          <v-chip size="small" color="grey" variant="outlined">
            Показани първите 50 от {{ visualizationData.length }} резултата
          </v-chip>
        </div>
      </div>

      <!-- Room Cards (Airbnb-style) -->
      <div v-if="visualizationType === 'room_cards' && visualizationData" class="room-cards-container">
        <div v-for="(room, roomIndex) in visualizationData" :key="roomIndex" class="room-card">
          <!-- Room Gallery Grid -->
          <div
            class="room-gallery-grid"
            :class="{
              'single-image': room.images.length === 1,
              'two-images': room.images.length === 2,
              'multi-images': room.images.length >= 3
            }"
            @click="openRoomGallery(room)"
          >
            <!-- Single image layout -->
            <div v-if="room.images.length === 1" class="room-gallery-item room-gallery-single">
              <img :src="room.images[0]" :alt="room.name" />
            </div>

            <!-- Two images layout -->
            <template v-else-if="room.images.length === 2">
              <div class="room-gallery-item room-gallery-half">
                <img :src="room.images[0]" :alt="room.name" />
              </div>
              <div class="room-gallery-item room-gallery-half">
                <img :src="room.images[1]" :alt="room.name" />
              </div>
            </template>

            <!-- Three or more images layout -->
            <template v-else>
              <!-- First image (larger) -->
              <div v-if="room.images[0]" class="room-gallery-item room-gallery-main">
                <img :src="room.images[0]" :alt="room.name" />
              </div>

              <!-- Additional images (smaller, stacked on right) -->
              <div class="room-gallery-side">
                <div v-if="room.images[1]" class="room-gallery-item room-gallery-small">
                  <img :src="room.images[1]" :alt="room.name" />
                </div>
                <div v-if="room.images[2]" class="room-gallery-item room-gallery-small room-gallery-more">
                  <img :src="room.images[2]" :alt="room.name" />
                  <div v-if="room.images.length > 3" class="room-gallery-overlay">
                    <v-icon size="24" color="white">mdi-image-multiple</v-icon>
                    <span class="room-overlay-text">+{{ room.images.length - 3 }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Room Info -->
          <div class="room-info">
            <h3 class="room-name">{{ room.name }}</h3>
            <p v-if="room.description" class="room-description">{{ room.description }}</p>
            <ul v-if="room.details.length > 0" class="room-details">
              <li v-for="(detail, detailIndex) in room.details.slice(0, 3)" :key="detailIndex">
                {{ detail }}
              </li>
              <li v-if="room.details.length > 3" class="room-more-details">
                +{{ room.details.length - 3 }} more details
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  visualizationType: {
    type: String,
    required: true,
    validator: (value) => ['room_details', 'booking_offers', 'availability', 'bookings', 'room_cards', 'excel_results'].includes(value)
  },
  visualizationData: {
    type: [Object, Array],
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'open-room-gallery'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const drawerTitle = computed(() => {
  const titles = {
    room_details: 'Детайли за стаите',
    booking_offers: 'Налични оферти',
    availability: 'Наличности',
    bookings: 'Резервации',
    room_cards: 'Галерия на стаите',
    excel_results: 'Резултати от Excel'
  }
  return titles[props.visualizationType] || 'Детайли'
})

function close() {
  isOpen.value = false
}

function openRoomGallery(room) {
  emit('open-room-gallery', room)
}

// Helper function to format date range for table row
function formatDateRangeLabel(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return ''

  try {
    const from = new Date(dateFrom)
    const to = new Date(dateTo)

    const fromDay = from.getDate()
    const toDay = to.getDate()

    const months = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
    const monthName = months[from.getMonth()]

    if (fromDay === toDay) {
      return `${fromDay} ${monthName}`
    } else {
      return `${fromDay}–${toDay} ${monthName}`
    }
  } catch {
    return `${dateFrom} - ${dateTo}`
  }
}

// Get all unique date ranges from all rooms
function getDateRangesForTable(rooms) {
  if (!rooms || rooms.length === 0) return []

  const allRanges = new Set()
  rooms.forEach(room => {
    room.dateRanges.forEach(range => {
      allRanges.add(`${range.date_from}|${range.date_to}`)
    })
  })

  const sortedRanges = Array.from(allRanges).sort((a, b) => {
    const [aFrom] = a.split('|')
    const [bFrom] = b.split('|')
    return aFrom.localeCompare(bFrom)
  })

  return sortedRanges.map(rangeKey => {
    const [date_from, date_to] = rangeKey.split('|')
    return {
      dateRange: { date_from, date_to },
      dateLabel: formatDateRangeLabel(date_from, date_to)
    }
  })
}

// Get quantity for specific date range and room
function getQtyForDateRange(dateRange, room) {
  if (!room || !room.dateRanges) return 0

  const match = room.dateRanges.find(range =>
    range.date_from === dateRange.date_from && range.date_to === dateRange.date_to
  )

  return match ? match.qty : 0
}

// Get CSS class for quantity cell
function getQtyCellClass(dateRange, room) {
  const qty = getQtyForDateRange(dateRange, room)
  if (qty === 0) return 'qty-zero'
  if (qty < 3) return 'qty-low'
  return 'qty-normal'
}

// Format booking date to Bulgarian short format
function formatBookingDate(dateStr) {
  if (!dateStr) return 'N/A'
  const months = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']
  try {
    const date = new Date(dateStr)
    return `${date.getDate()} ${months[date.getMonth()]}`
  } catch {
    return dateStr
  }
}

// Get color for booking status
function getBookingStatusColor(status) {
  const statusMap = {
    'new': 'blue',
    'confirmed': 'green',
    'cancelled': 'red',
    'completed': 'grey',
    'no_show': 'orange'
  }
  return statusMap[status] || 'grey'
}

// Get Bulgarian label for booking status
function getBookingStatusLabel(status) {
  const labelMap = {
    'new': 'Нова',
    'confirmed': 'Потвърдена',
    'cancelled': 'Отменена',
    'completed': 'Завършена',
    'no_show': 'Неявяване'
  }
  return labelMap[status] || status
}

// Get color for payment status
function getPaymentStatusColor(status) {
  const statusMap = {
    'WAITING': 'orange',
    'PAID': 'green',
    'PARTIALLY_PAID': 'blue',
    'REFUNDED': 'grey',
    'CANCELLED': 'red'
  }
  return statusMap[status] || 'grey'
}

// Get Bulgarian label for payment status
function getPaymentStatusLabel(status) {
  const labelMap = {
    'WAITING': 'Очаква плащане',
    'PAID': 'Платена',
    'PARTIALLY_PAID': 'Частично платена',
    'REFUNDED': 'Възстановена',
    'CANCELLED': 'Отменена'
  }
  return labelMap[status] || status
}

// Format Excel cell value for display
function formatExcelCellValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Да' : 'Не'
  if (typeof value === 'number') {
    // Check if it's a date serial number (Excel dates are numbers > 40000)
    if (value > 40000 && value < 60000) {
      try {
        const date = new Date((value - 25569) * 86400 * 1000)
        return date.toLocaleDateString('bg-BG')
      } catch {
        return value
      }
    }
    return value
  }
  if (typeof value === 'string') {
    // Truncate very long strings
    if (value.length > 100) return value.substring(0, 97) + '...'
    return value
  }
  return String(value)
}
</script>

<style scoped>
.visualization-drawer {
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-surface));
}

.drawer-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drawer-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.drawer-content {
  padding: 24px;
  overflow-y: auto;
  height: calc(100vh - 80px);
}

/* Room Details Display Styles */
.room-details-display {
  width: 100%;
}

.rooms-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.room-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.room-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.room-image-container {
  width: 100%;
  height: 250px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.room-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-info-container {
  padding: 20px;
}

.room-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: rgb(var(--v-theme-on-surface));
}

.room-type {
  font-size: 0.9rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 16px;
}

.room-specs {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.room-spec-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.room-description {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.8);
  margin-bottom: 16px;
}

/* Booking Offers Display Styles */
.booking-offers-display {
  width: 100%;
}

.offers-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.offer-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.offer-card:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2);
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.offer-info-container {
  padding: 20px;
}

.offer-room-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: rgb(var(--v-theme-on-surface));
}

.offer-rate-name {
  font-size: 0.9rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 16px;
}

.offer-price-section {
  background: rgba(var(--v-theme-primary), 0.08);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
}

.offer-total-price {
  font-size: 1.75rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 4px;
}

.offer-price-per-night {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.offer-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.offer-detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.no-data-message {
  text-align: center;
  padding: 40px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-style: italic;
}

/* Availability Summary Styles */
.availability-summary {
  width: 100%;
}

.availability-table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.availability-table {
  width: 100%;
  border-collapse: collapse;
  background: rgb(var(--v-theme-surface));
}

.availability-table thead {
  background: rgba(var(--v-theme-primary), 0.08);
}

.table-header-cell {
  padding: 14px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgb(var(--v-theme-on-surface));
  border-bottom: 2px solid rgba(var(--v-theme-on-surface), 0.12);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.table-header-cell:last-child {
  border-right: none;
}

.room-header {
  text-align: center;
  min-width: 120px;
}

.table-row {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: rgba(var(--v-theme-primary), 0.03);
}

.table-cell {
  padding: 12px 16px;
  font-size: 0.9rem;
  color: rgb(var(--v-theme-on-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.table-cell:last-child {
  border-right: none;
}

.date-cell {
  font-weight: 500;
  white-space: nowrap;
}

.qty-cell {
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
}

.qty-normal {
  background: rgba(var(--v-theme-success), 0.08);
  color: rgb(var(--v-theme-success));
}

.qty-low {
  background: rgba(var(--v-theme-warning), 0.12);
  color: rgb(var(--v-theme-warning));
}

.qty-zero {
  background: rgba(var(--v-theme-error), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.4);
}

/* Bookings Summary Styles */
.bookings-summary {
  width: 100%;
}

.bookings-table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.bookings-table {
  width: 100%;
  border-collapse: collapse;
  background: rgb(var(--v-theme-surface));
}

.bookings-table thead {
  background: rgba(var(--v-theme-primary), 0.08);
}

.booking-id-cell {
  font-family: 'Courier New', monospace;
  color: rgb(var(--v-theme-primary));
  font-size: 0.9rem;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-weight: 500;
}

.date-separator {
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-weight: 400;
}

.room-cell {
  max-width: 220px;
}

.room-info {
  padding: 4px 0;
  font-weight: 500;
}

.guests-cell {
  white-space: nowrap;
}

.guests-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.client-cell {
  max-width: 200px;
}

.client-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.client-email {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.amount-cell {
  text-align: right;
  font-family: 'Courier New', monospace;
  color: rgb(var(--v-theme-success));
  font-size: 1rem;
  white-space: nowrap;
}

.bookings-footer {
  margin-top: 16px;
  text-align: center;
}

/* Excel Results Table Styles */
.excel-results-summary {
  width: 100%;
}

.excel-table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  max-height: 600px;
  overflow-y: auto;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  background: rgb(var(--v-theme-surface));
  font-size: 0.9rem;
}

.excel-table thead {
  background: rgba(var(--v-theme-primary), 0.08);
  position: sticky;
  top: 0;
  z-index: 10;
}

.excel-table thead th {
  font-weight: 600;
  text-transform: none;
  white-space: nowrap;
}

.excel-table tbody tr:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.excel-footer {
  margin-top: 16px;
  text-align: center;
}

/* Room Cards (Airbnb-style) */
.room-cards-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Room Gallery Grid */
.room-gallery-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 4px;
  cursor: pointer;
  position: relative;
  height: 250px;
}

/* Single image layout */
.room-gallery-grid.single-image {
  display: block;
  height: 280px;
  grid-template-columns: unset;
}

.room-gallery-single {
  width: 100%;
  height: 100%;
}

.room-gallery-single img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Two images layout */
.room-gallery-grid.two-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  height: 280px;
}

.room-gallery-half {
  width: 100%;
  height: 100%;
}

.room-gallery-half img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-gallery-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-gallery-item {
  position: relative;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.room-gallery-main {
  height: 100%;
}

.room-gallery-small {
  height: 50%;
}

.room-gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.room-gallery-grid:hover .room-gallery-item img {
  transform: scale(1.08);
}

.room-gallery-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  backdrop-filter: blur(3px);
}

.room-overlay-text {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 6px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* Room Info Section for cards */
.room-info {
  padding: 16px;
  text-align: center;
}

.room-details {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.room-details li {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.room-more-details {
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
  cursor: pointer;
}
</style>
