# Document RAG System - Setup Complete ✅

## Google Cloud Infrastructure

### 1. Cloud Storage Bucket ✅
- **Bucket Name**: `quendoo-hotel-documents`
- **Location**: `us-central1`
- **Access**: Uniform bucket-level access
- **CORS**: Configured for Firebase Hosting and localhost
- **URL**: `gs://quendoo-hotel-documents/`

### 2. Firestore Indexes ✅
Two composite indexes created for `hotel_documents` collection:

#### Index 1: Basic Query (hotelId + createdAt)
```
Fields:
  - hotelId (ASCENDING)
  - createdAt (DESCENDING)
Status: READY
```

#### Index 2: Filtered Query (hotelId + documentType + createdAt)
```
Fields:
  - hotelId (ASCENDING)
  - documentType (ASCENDING)
  - createdAt (DESCENDING)
Status: READY
```

### 3. Environment Variables ✅
Added to `backend/mcp-client/.env`:
```env
GOOGLE_CLOUD_PROJECT=quendoo-ai-dashboard
GCS_BUCKET_NAME=quendoo-hotel-documents
```

## System Architecture

### Document Upload Flow
1. **Frontend**: User uploads PDF/DOCX via DocumentUpload.vue
2. **Backend**: POST /api/documents/upload
   - Extract text with pdf-parse/mammoth
   - Chunk text (1000 chars, 200 overlap)
   - Generate embeddings with Vertex AI (768-dim)
   - Save to Cloud Storage
   - Store metadata + embeddings in Firestore
3. **Storage**:
   - File → `gs://quendoo-hotel-documents/hotel_{hotelId}/timestamp_filename.pdf`
   - Metadata + Vectors → Firestore `hotel_{hotelId}/documents/hotel_documents/{docId}`

### Document Search Flow (RAG)
1. **User**: Asks question in chat
2. **Claude**: Decides to use `search_hotel_documents` tool
3. **Backend**:
   - Generate query embedding with Vertex AI
   - Cosine similarity search in Firestore
   - Return top-K relevant chunks
4. **Claude**: Uses chunks to answer question

## Multi-Tenant Security

### Namespace Isolation
- Each hotel's documents are stored in separate Firestore namespace: `hotel_{hotelId}/documents/hotel_documents`
- Query-level filtering: All queries include `hotelId` from JWT token
- JWT middleware: hotelId from token ONLY, never from request body

### Authentication
- All endpoints require `requireHotelAuth` middleware
- JWT token validated on every request
- hotelId extracted from verified token

## API Endpoints

### Upload Document
```http
POST /api/documents/upload
Authorization: Bearer {hotelToken}
Content-Type: multipart/form-data

Body:
  - file: PDF or DOCX (max 10 MB)
  - documentType: contract|invoice|menu|policy|procedure|manual|other
  - tags: JSON array of tags
  - description: Optional description
```

### List Documents
```http
GET /api/documents?documentType=contract&limit=10
Authorization: Bearer {hotelToken}
```

### Delete Document
```http
DELETE /api/documents/{documentId}
Authorization: Bearer {hotelToken}
```

## MCP Tool for Claude

### Tool Name
`search_hotel_documents`

### Parameters
```json
{
  "query": "string (natural language search query)",
  "documentTypes": ["contract", "invoice", ...] (optional filter),
  "topK": 3 (number of results, 1-10)
}
```

### Response
```json
{
  "success": true,
  "query": "user query",
  "resultsCount": 3,
  "results": [
    {
      "rank": 1,
      "fileName": "contract.pdf",
      "documentType": "contract",
      "relevanceScore": 0.87,
      "excerpt": "First 500 chars...",
      "fullText": "Complete chunk text",
      "structuredData": {...},
      "tags": ["tag1", "tag2"]
    }
  ],
  "summary": "Found 3 relevant excerpts..."
}
```

## Frontend Routes

### Main Documents Page
- **Route**: `/documents`
- **Component**: DocumentsView.vue
- **Access**: Requires hotel authentication

### Navigation
- Sidebar button: "Documents" (between "New Chat" and "Settings")
- Direct link: Click "Documents" → Navigate to /documents

## Testing Checklist

- [ ] Upload PDF document
- [ ] Upload DOCX document
- [ ] List documents with filters
- [ ] Delete document
- [ ] Ask Claude to search in documents
- [ ] Verify multi-tenant isolation (different hotels can't see each other's docs)
- [ ] Check vector embeddings are stored
- [ ] Verify vectors are deleted when document is deleted

## Cost Estimates (per month)

### Vertex AI Embeddings
- $0.025 per 1M characters
- Example: 100 documents × 10 pages × 2000 chars = 2M chars = $0.05

### Firestore
- Storage: $0.18 per GB
- Reads: $0.06 per 100K reads
- Example: 100 documents × 10 chunks × 1KB = 1 MB = $0.0002

### Cloud Storage
- Storage: $0.020 per GB
- Example: 100 documents × 500 KB = 50 MB = $0.001

**Total for 100 documents**: ~$0.06/month

## Troubleshooting

### Upload fails with "Bucket not found"
- Verify GCS_BUCKET_NAME in .env matches bucket name
- Check bucket exists: `gcloud storage buckets list`

### "Index not found" error
- Check indexes are READY: `gcloud firestore indexes composite list`
- Wait for indexes to finish building (can take 5-10 minutes)

### "Embedding service failed"
- Verify Vertex AI API is enabled
- Check GOOGLE_CLOUD_PROJECT is set correctly
- Ensure Application Default Credentials are configured

### Documents not appearing
- Check hotelId matches between upload and list
- Verify JWT token is valid
- Check Firestore namespace: `hotel_{hotelId}/documents/hotel_documents`

## Production Deployment

Before deploying to production:

1. Enable Firestore in production mode (currently USE_FIRESTORE=false)
2. Update .env: `USE_FIRESTORE=true`
3. Configure service account with permissions:
   - Storage Admin (for GCS uploads)
   - Datastore User (for Firestore)
   - Vertex AI User (for embeddings)
4. Set up monitoring for:
   - Upload failures
   - Embedding generation errors
   - Search query latency
5. Configure backup for:
   - Firestore documents
   - Cloud Storage files

## Next Steps

- [ ] Add document preview/download functionality
- [ ] Implement document sharing between hotels
- [ ] Add OCR for scanned PDFs (Google Document AI)
- [ ] Support additional file types (Excel, PowerPoint)
- [ ] Add document versioning
- [ ] Implement document expiration/archival
- [ ] Add analytics (most searched documents, search success rate)

---

**Setup completed on**: 2026-01-09
**Status**: ✅ Ready for testing
