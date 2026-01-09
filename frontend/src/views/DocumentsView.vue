<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DocumentUpload from '@/components/documents/DocumentUpload.vue'
import DocumentList from '@/components/documents/DocumentList.vue'

const router = useRouter()
const documentListRef = ref(null)

function handleDocumentUploaded(document) {
  console.log('Document uploaded:', document)

  // Reload the document list
  if (documentListRef.value) {
    documentListRef.value.loadDocuments()
  }
}

function goBackToChat() {
  router.push('/chat')
}
</script>

<template>
  <div class="documents-view">
    <div class="header-section">
      <div class="d-flex align-center">
        <v-icon size="32" class="mr-3">mdi-file-document-multiple</v-icon>
        <h1 class="text-h4">Document Management</h1>
      </div>

      <v-btn
        variant="outlined"
        prepend-icon="mdi-arrow-left"
        @click="goBackToChat"
      >
        Back to Chat
      </v-btn>
    </div>

    <!-- Upload Section -->
    <div class="upload-section">
      <DocumentUpload @uploaded="handleDocumentUploaded" />
    </div>

    <!-- Documents List Section -->
    <div class="list-section">
      <DocumentList ref="documentListRef" />
    </div>
  </div>
</template>

<style scoped>
.documents-view {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  background: rgb(var(--v-theme-background));
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.upload-section {
  padding: 0 24px 24px;
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
}

.list-section {
  padding: 0 24px 24px;
  margin: 0 auto;
  flex: 1;
  width: 100%;
  max-width: 1200px;
}
</style>
