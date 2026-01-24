<template>
  <div class="message-visualizations">
    <!-- Room Cards View Button -->
    <div v-if="hasRoomImages && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-image-multiple"
        color="primary"
        @click="openRoomGallery"
      >
        Виж галерия на стаите ({{ roomCards.length }})
      </v-btn>
    </div>

    <!-- Availability View Button -->
    <div v-if="hasAvailability && availabilitySummary && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-chart-bar"
        color="primary"
        @click="openVisualizationDrawer('availability', availabilitySummary)"
      >
        Виж наличности ({{ availabilitySummary.rooms?.length || 0 }} стаи)
      </v-btn>
    </div>

    <!-- Bookings View Button -->
    <div v-if="hasBookings && bookingsData && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-calendar-check"
        color="primary"
        @click="openVisualizationDrawer('bookings', bookingsData)"
      >
        Виж резервации ({{ bookingsData.length }})
      </v-btn>
    </div>

    <!-- Room Details View Button -->
    <div v-if="hasRoomDetails && roomDetailsData && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-bed"
        color="primary"
        @click="openVisualizationDrawer('room_details', roomDetailsData)"
      >
        Виж детайли за стаите ({{ roomDetailsData.data?.length || 0 }})
      </v-btn>
    </div>

    <!-- Booking Offers View Button -->
    <div v-if="hasBookingOffers && bookingOffersData && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-tag-multiple"
        color="primary"
        @click="openVisualizationDrawer('booking_offers', bookingOffersData)"
      >
        Виж налични оферти ({{ bookingOffersData.data?.length || 0 }})
      </v-btn>
    </div>

    <!-- Excel Query Results - View Button -->
    <div v-if="hasExcelQuery && excelQueryData && excelQueryData.resultsCount > 0 && !isStreaming" class="view-details-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-file-table-box-multiple"
        color="primary"
        @click="openVisualizationDrawer('excel_results', excelQueryData.results.map(r => r.data || r.rowData))"
      >
        Виж резултати от Excel ({{ excelQueryData.resultsCount }})
      </v-btn>
    </div>

    <!-- Table Viewer Button -->
    <div v-if="hasTable && !isStreaming && !isTyping" class="table-viewer-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-table-eye"
        color="primary"
        @click="openTableViewer"
      >
        View as Table
      </v-btn>
    </div>

    <!-- Availability Calendar Button -->
    <div v-if="hasAvailability && !isStreaming" class="availability-viewer-button">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-calendar-check"
        color="success"
        @click="openAvailabilityPanel"
      >
        View Availability Calendar
      </v-btn>
    </div>

    <!-- Scraper Progress Component -->
    <ScraperProgress
      v-if="scraperCacheKey"
      :cache-key="scraperCacheKey"
      class="scraper-progress-container"
    />

    <!-- Batch Scraper Progress Component -->
    <BatchScraperProgress
      v-if="batchScraperBatchId"
      :batch-id="batchScraperBatchId"
      class="batch-scraper-progress-container"
    />

    <!-- Visualization Components -->
    <TableViewer
      v-model="tableViewerOpen"
      :table-data="parsedTableData"
    />

    <RoomGallery
      v-model="roomGalleryOpen"
      :title="'Room Photos'"
      :images="roomImages"
    />

    <AvailabilityPanel
      v-model="availabilityPanelOpen"
      :raw-data="availabilityData"
    />

    <VisualizationDrawer
      v-model="visualizationDrawerOpen"
      :visualization-type="currentVisualizationType"
      :visualization-data="currentVisualizationData"
      @open-room-gallery="openRoomGallery"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TableViewer from '@/components/common/TableViewer.vue'
import RoomGallery from '@/components/chat/RoomGallery.vue'
import AvailabilityPanel from '@/components/chat/AvailabilityPanel.vue'
import VisualizationDrawer from '@/components/chat/VisualizationDrawer.vue'
import ScraperProgress from '@/components/chat/ScraperProgress.vue'
import BatchScraperProgress from '@/components/chat/BatchScraperProgress.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  toolsUsed: {
    type: Array,
    default: () => []
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  isTyping: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['open-availability'])

// Drawer/Panel states
const tableViewerOpen = ref(false)
const roomGalleryOpen = ref(false)
const availabilityPanelOpen = ref(false)
const visualizationDrawerOpen = ref(false)
const currentVisualizationType = ref('')
const currentVisualizationData = ref(null)

// Helper function to unwrap MCP protocol result format
function unwrapMCPResult(toolResult) {
  if (!toolResult) return null

  let unwrapped = toolResult

  // Level 1: toolResult.result
  if (unwrapped && typeof unwrapped === 'object' && 'result' in unwrapped) {
    unwrapped = unwrapped.result
  }

  // Level 2: result.result (nested MCP wrapping)
  if (unwrapped && typeof unwrapped === 'object' && 'result' in unwrapped) {
    unwrapped = unwrapped.result
  }

  return unwrapped
}

// Detect if message contains markdown table
const hasTable = computed(() => {
  if (!props.message.content) return false
  const tablePattern = /\|.+\|[\r\n]+\|[-:\s|]+\|/
  return tablePattern.test(props.message.content)
})

// Parse markdown table into structured data
const parsedTableData = computed(() => {
  if (!hasTable.value) return { headers: [], rows: [] }

  const content = props.message.content
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'))

  if (lines.length < 2) return { headers: [], rows: [] }

  // Extract headers (first line)
  const headerLine = lines[0]
  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim())

  // Extract data rows (skip separator line)
  const rows = lines.slice(2).map(line => {
    return line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
  })

  return { headers, rows }
})

// Detect room cards from message content
const roomCards = computed(() => {
  if (!props.message.content) return []

  const content = props.message.content
  const lines = content.split('\n')
  const rooms = []

  const imageUrlPattern = /https:\/\/booking\.quendoo\.com\/files\/[^\s)]+\.(jpg|jpeg|png|gif|webp)/gi

  let currentRoom = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Detect room headers
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/)
    const boldMatch = line.match(/^\*\*([^*]+)\*\*/)
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/)

    if (numberedMatch || boldMatch || headerMatch) {
      let name = ''

      if (numberedMatch) {
        name = numberedMatch[2].trim()
      } else if (boldMatch) {
        name = boldMatch[1].trim()
      } else if (headerMatch) {
        name = headerMatch[1].trim()
      }

      // Skip generic headers
      if (!name.match(/^(Room Types?|Available Rooms?|Налични|типове стаи|стаи)$/i)) {
        if (currentRoom && currentRoom.images.length > 0) {
          rooms.push(currentRoom)
        }

        currentRoom = {
          name: name,
          images: [],
          description: '',
          details: []
        }
      }
    }

    // Extract image URLs
    const urlsInLine = line.match(imageUrlPattern) || []
    if (urlsInLine.length > 0 && currentRoom) {
      urlsInLine.forEach(url => {
        currentRoom.images.push(url)
      })
    }

    // Extract details
    if (currentRoom && line.match(/^[○\-•*]\s+(.+)$/)) {
      const detail = line.replace(/^[○\-•*]\s+/, '').trim()
      let cleanDetail = detail.split(':')[0].trim()
      cleanDetail = cleanDetail.replace(/\*\*(.+?)\*\*/g, '$1')
      if (!cleanDetail.includes('http') && cleanDetail.length > 0) {
        currentRoom.details.push(cleanDetail)
      }
    }

    // Extract description
    if (currentRoom && !line.match(/^[\d\-•*#○]/) && line.length > 0 && !line.includes('http') && !boldMatch && !headerMatch && !numberedMatch) {
      if (currentRoom.description.length === 0) {
        currentRoom.description = line
      }
    }
  }

  // Save last room
  if (currentRoom && currentRoom.images.length > 0) {
    rooms.push(currentRoom)
  }

  return rooms
})

const hasRoomImages = computed(() => roomCards.value.length > 0)

// Flatten all images for carousel
const roomImages = computed(() => {
  const allImages = []
  roomCards.value.forEach(room => {
    room.images.forEach(url => {
      allImages.push({
        url,
        roomName: room.name,
        description: room.description
      })
    })
  })
  return allImages
})

// Detect availability tool usage
const hasAvailability = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return false
  return props.toolsUsed.some(tool => tool.name === 'get_availability' && tool.result)
})

// Get availability data
const availabilityData = computed(() => {
  if (!hasAvailability.value) return null
  const availabilityTool = props.toolsUsed.find(tool => tool.name === 'get_availability' && tool.result)
  if (!availabilityTool) return null

  return availabilityTool.result.result || availabilityTool.result
})

// Create availability summary
const availabilitySummary = computed(() => {
  if (!availabilityData.value) return null

  const data = availabilityData.value
  if (!data.availability || !Array.isArray(data.availability)) return null

  const roomsMap = new Map()

  const sortedEntries = [...data.availability].sort((a, b) => {
    const roomCompare = (a.room_name || '').localeCompare(b.room_name || '')
    if (roomCompare !== 0) return roomCompare
    return a.date.localeCompare(b.date)
  })

  sortedEntries.forEach(entry => {
    if (!roomsMap.has(entry.room_id)) {
      roomsMap.set(entry.room_id, {
        room_id: entry.room_id,
        room_name: entry.room_name || `Room ${entry.room_id}`,
        dateRanges: []
      })
    }

    const room = roomsMap.get(entry.room_id)
    const lastRange = room.dateRanges[room.dateRanges.length - 1]

    if (lastRange && lastRange.qty === entry.qty && entry.is_opened) {
      lastRange.date_to = entry.date
    } else if (entry.is_opened && entry.qty > 0) {
      room.dateRanges.push({
        date_from: entry.date,
        date_to: entry.date,
        qty: entry.qty
      })
    }
  })

  return {
    date_from: data.date_from,
    date_to: data.date_to,
    rooms: Array.from(roomsMap.values()).filter(room => room.dateRanges.length > 0)
  }
})

// Detect bookings tool usage
const hasBookings = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return false

  return props.toolsUsed.some(tool =>
    tool.name === 'get_bookings' &&
    tool.result &&
    (tool.result.result?.data || tool.result.data)
  )
})

// Get bookings data
const bookingsData = computed(() => {
  if (!hasBookings.value) return null
  const bookingsTool = props.toolsUsed.find(tool => tool.name === 'get_bookings' && tool.result)
  if (!bookingsTool || !bookingsTool.result) return null

  const actualResult = bookingsTool.result.result || bookingsTool.result
  if (!actualResult.data) return null

  return actualResult.data.map(booking => ({
    booking_id: booking.booking_id,
    status: booking.booking_status,
    payment_status: booking.payment_status,
    checkin_date: booking.checkin_date,
    checkout_date: booking.checkout_date,
    client_name: booking.client?.name || 'N/A',
    client_email: booking.client?.email || 'N/A',
    total_amount: booking.total_amount,
    currency: booking.currency,
    rooms: booking.booking_items?.map(item => ({
      room_name: item.room_name,
      adults: item.adults,
      children: item.children,
      amount: item.amount
    })) || [],
    created: booking.created_datetime
  }))
})

// Detect room details tool usage
const hasRoomDetails = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return false
  return props.toolsUsed.some(tool => tool.name === 'get_rooms_details' && tool.result)
})

// Get room details data
const roomDetailsData = computed(() => {
  if (!hasRoomDetails.value) return null
  const roomDetailsTool = props.toolsUsed.find(tool => tool.name === 'get_rooms_details' && tool.result)
  if (!roomDetailsTool) return null

  return unwrapMCPResult(roomDetailsTool.result)
})

// Detect booking offers tool usage
const hasBookingOffers = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return false
  return props.toolsUsed.some(tool => tool.name === 'get_booking_offers' && tool.result)
})

// Get booking offers data
const bookingOffersData = computed(() => {
  if (!hasBookingOffers.value) return null
  const offersTool = props.toolsUsed.find(tool => tool.name === 'get_booking_offers' && tool.result)
  if (!offersTool) return null

  return unwrapMCPResult(offersTool.result)
})

// Detect Excel query tool usage
const hasExcelQuery = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return false
  return props.toolsUsed.some(tool => tool.name === 'query_excel_data' && tool.result)
})

// Get Excel query data
const excelQueryData = computed(() => {
  if (!hasExcelQuery.value) return null
  const excelTool = props.toolsUsed.find(tool => tool.name === 'query_excel_data' && tool.result)
  if (!excelTool) return null

  return unwrapMCPResult(excelTool.result)
})

// Detect scraper cache key
const scraperCacheKey = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return null

  const scraperTool = props.toolsUsed.find(tool => tool.name === 'scrape_competitor_prices')
  if (!scraperTool) {
    // Fallback: Check check_scrape_status
    const checkStatusTool = props.toolsUsed.find(tool => tool.name === 'check_scrape_status')
    if (checkStatusTool) {
      try {
        const plainResult = JSON.parse(JSON.stringify(checkStatusTool.result))
        if (plainResult?.cacheKey) {
          return plainResult.cacheKey
        }
      } catch (e) {
        // Ignore
      }
    }
    return null
  }

  let cacheKey = null

  if (scraperTool.result?.cacheKey) {
    cacheKey = scraperTool.result.cacheKey
  }

  if (!cacheKey && scraperTool.result?.result?.cacheKey) {
    cacheKey = scraperTool.result.result.cacheKey
  }

  if (!cacheKey) {
    const unwrapped = unwrapMCPResult(scraperTool.result)
    cacheKey = unwrapped?.cacheKey
  }

  if (!cacheKey && scraperTool.cacheKey) {
    cacheKey = scraperTool.cacheKey
  }

  return cacheKey
})

// Detect batch scraper batch ID
const batchScraperBatchId = computed(() => {
  if (!props.toolsUsed || props.toolsUsed.length === 0) return null

  const batchScraperTool = props.toolsUsed.find(tool => tool.name === 'scrape_and_compare_hotels')
  if (!batchScraperTool) return null

  let batchId = null

  if (batchScraperTool.result?.batchId) {
    batchId = batchScraperTool.result.batchId
  }

  if (!batchId && batchScraperTool.result?.result?.batchId) {
    batchId = batchScraperTool.result.result.batchId
  }

  if (!batchId && batchScraperTool.result) {
    const unwrapped = unwrapMCPResult(batchScraperTool.result)
    batchId = unwrapped?.batchId
  }

  if (!batchId && batchScraperTool.batchId) {
    batchId = batchScraperTool.batchId
  }

  return batchId
})

// Action handlers
function openTableViewer() {
  tableViewerOpen.value = true
}

function openRoomGallery() {
  roomGalleryOpen.value = true
}

function openAvailabilityPanel() {
  emit('open-availability', availabilityData.value)
}

function openVisualizationDrawer(type, data) {
  currentVisualizationType.value = type
  currentVisualizationData.value = data
  visualizationDrawerOpen.value = true
}
</script>

<style scoped>
.message-visualizations {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-details-button {
  margin-top: 12px;
  margin-bottom: 8px;
}

.table-viewer-button {
  margin-top: 12px;
  margin-bottom: 4px;
}

.availability-viewer-button {
  margin-top: 12px;
  margin-bottom: 8px;
}

.scraper-progress-container {
  margin-top: 12px;
  margin-bottom: 8px;
}

.batch-scraper-progress-container {
  margin-top: 12px;
  margin-bottom: 8px;
}
</style>
