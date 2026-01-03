<template>
  <v-navigation-drawer
    v-model="isOpen"
    location="right"
    temporary
    width="800"
    class="table-viewer-drawer"
  >
    <div class="table-viewer-container">
      <!-- Header -->
      <div class="table-viewer-header">
        <div class="header-content">
          <v-icon icon="mdi-table" size="20" color="primary" />
          <span class="header-title">Table View</span>
        </div>
        <v-btn
          icon
          variant="text"
          size="small"
          @click="close"
        >
          <v-icon size="20">mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Table Content -->
      <div class="table-content">
        <div class="table-wrapper">
          <table class="excel-table">
            <thead>
              <tr>
                <th v-for="(header, index) in headers" :key="index" class="excel-header">
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in rows" :key="rowIndex" class="excel-row">
                <td v-for="(cell, cellIndex) in row" :key="cellIndex" class="excel-cell">
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="table-viewer-footer">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-download"
          @click="exportToCSV"
          size="small"
        >
          Export CSV
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-content-copy"
          @click="copyToClipboard"
          size="small"
        >
          Copy
        </v-btn>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  tableData: {
    type: Object,
    required: true,
    // Expected format: { headers: [], rows: [[]] }
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const headers = computed(() => props.tableData.headers || [])
const rows = computed(() => props.tableData.rows || [])

function close() {
  isOpen.value = false
}

function exportToCSV() {
  const csvContent = [
    headers.value.join(','),
    ...rows.value.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `table_export_${Date.now()}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function copyToClipboard() {
  const tableText = [
    headers.value.join('\t'),
    ...rows.value.map(row => row.join('\t'))
  ].join('\n')

  navigator.clipboard.writeText(tableText).then(() => {
    console.log('[TableViewer] Copied to clipboard')
  })
}
</script>

<style scoped>
.table-viewer-drawer {
  z-index: 1000;
}

.table-viewer-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.table-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.table-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.table-wrapper {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: auto;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-family: 'Inter', -apple-system, sans-serif;
}

.excel-header {
  background: #f8f9fa;
  color: #212529;
  font-weight: 600;
  text-align: left;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
}

.excel-row:nth-child(even) {
  background: #f8f9fa;
}

.excel-row:hover {
  background: #e9ecef;
}

.excel-cell {
  padding: 10px 16px;
  border: 1px solid #dee2e6;
  color: #212529;
  white-space: nowrap;
}

.table-viewer-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
}

/* Custom scrollbar for table */
.table-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
