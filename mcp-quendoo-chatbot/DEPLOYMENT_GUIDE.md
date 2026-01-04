# MCP Quendoo Chatbot - Deployment Guide

## Local Development

### 1. Install Dependencies

```bash
cd mcp-quendoo-chatbot

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Generate Encryption Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output to your `.env` file.

### 3. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
ENCRYPTION_KEY=<generated-fernet-key>
JWT_SECRET=<your-jwt-secret>
DATABASE_URL=sqlite:///./chatbot.db
```

### 4. Run Locally

```bash
python -m uvicorn app.main:app --reload --port 8000
```

Visit: http://localhost:8000/docs

### 5. Test API

**Create a tenant:**
```bash
curl -X POST http://localhost:8000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "hotel-test-123",
    "name": "Test Hotel"
  }'
```

**Save API key:**
```bash
curl -X POST http://localhost:8000/admin/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "hotel-test-123",
    "key_name": "QUENDOO_API_KEY",
    "key_value": "your-quendoo-api-key-here"
  }'
```

**Connect:**
```bash
curl -X POST http://localhost:8000/mcp/connect \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "hotel-test-123",
    "metadata": {"source": "test"}
  }'
```

Save the `connection_id` from response.

**Execute tool:**
```bash
curl -X POST http://localhost:8000/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "conn_xxxxx",
    "tool_name": "get_property_settings",
    "tool_args": {}
  }'
```

---

## Google Cloud Run Deployment

### Prerequisites

```bash
# Install Google Cloud SDK
# Windows: Download from https://cloud.google.com/sdk/docs/install
# Linux/Mac: curl https://sdk.cloud.google.com | bash

# Login to Google Cloud
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID
```

### Method 1: Deploy from source

```bash
cd mcp-quendoo-chatbot

# Generate encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate JWT secret
openssl rand -base64 32

# Deploy
gcloud run deploy mcp-quendoo-chatbot \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENCRYPTION_KEY=<your-fernet-key>,JWT_SECRET=<your-jwt-secret>,DATABASE_URL=sqlite:///./chatbot.db"
```

### Method 2: Deploy with Docker

```bash
# Build Docker image
docker build -t mcp-quendoo-chatbot .

# Tag for Google Container Registry
docker tag mcp-quendoo-chatbot gcr.io/YOUR_PROJECT_ID/mcp-quendoo-chatbot

# Push to GCR
docker push gcr.io/YOUR_PROJECT_ID/mcp-quendoo-chatbot

# Deploy to Cloud Run
gcloud run deploy mcp-quendoo-chatbot \
  --image gcr.io/YOUR_PROJECT_ID/mcp-quendoo-chatbot \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "ENCRYPTION_KEY=<your-key>,JWT_SECRET=<your-secret>"
```

### With Cloud SQL PostgreSQL

**1. Create Cloud SQL instance:**
```bash
gcloud sql instances create mcp-chatbot-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1
```

**2. Create database:**
```bash
gcloud sql databases create chatbot --instance=mcp-chatbot-db
```

**3. Get connection name:**
```bash
gcloud sql instances describe mcp-chatbot-db --format="value(connectionName)"
```

**4. Deploy with Cloud SQL:**
```bash
gcloud run deploy mcp-quendoo-chatbot \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=YOUR_CONNECTION_NAME \
  --set-env-vars "DATABASE_URL=postgresql://user:password@/chatbot?host=/cloudsql/YOUR_CONNECTION_NAME,ENCRYPTION_KEY=<key>,JWT_SECRET=<secret>"
```

---

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENCRYPTION_KEY` | Fernet encryption key for API keys | Yes | - |
| `JWT_SECRET` | JWT secret for authentication | Yes | - |
| `DATABASE_URL` | Database connection string | No | `sqlite:///./chatbot.db` |
| `HOST` | Server host | No | `0.0.0.0` |
| `PORT` | Server port | No | `8000` |
| `DEBUG` | Debug mode | No | `False` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | No | localhost + dashboard |
| `MAX_CONNECTIONS_PER_TENANT` | Max connections per tenant | No | `10` |
| `CONNECTION_TIMEOUT_MINUTES` | Connection timeout | No | `60` |

---

## Post-Deployment

### 1. Get service URL

```bash
gcloud run services describe mcp-quendoo-chatbot \
  --region us-central1 \
  --format="value(status.url)"
```

Example: `https://mcp-quendoo-chatbot-xxxxx.run.app`

### 2. Update Dashboard backend

Update `backend/mcp-client/.env`:
```
PYTHON_MCP_SERVER_URL=https://mcp-quendoo-chatbot-xxxxx.run.app
MCP_JWT_TOKEN=your-jwt-token
```

### 3. Test deployment

```bash
# Health check
curl https://mcp-quendoo-chatbot-xxxxx.run.app/health

# API docs
# Visit: https://mcp-quendoo-chatbot-xxxxx.run.app/docs
```

---

## Monitoring

### View logs

```bash
gcloud run services logs read mcp-quendoo-chatbot \
  --region us-central1 \
  --limit 100
```

### Follow logs

```bash
gcloud run services logs tail mcp-quendoo-chatbot \
  --region us-central1
```

### Metrics

Visit Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/mcp-quendoo-chatbot/metrics

---

## Troubleshooting

### Connection failed

- Check ENCRYPTION_KEY is set correctly
- Verify tenant has QUENDOO_API_KEY saved
- Check database connection

### Tool execution fails

- Verify Quendoo API key is valid
- Check tool arguments match schema
- Review Cloud Run logs

### Database issues

**SQLite:**
- Database file persists only within single container
- Use Cloud SQL for production

**PostgreSQL:**
- Ensure Cloud SQL instance is running
- Verify connection string format
- Check Cloud SQL permissions

---

## Security Best Practices

1. **Encryption Key**: Generate strong Fernet key, never commit to git
2. **JWT Secret**: Use strong random string (32+ characters)
3. **API Keys**: Always encrypted at rest, never logged
4. **CORS**: Restrict to known domains only
5. **Authentication**: Add JWT authentication to admin endpoints
6. **Database**: Use Cloud SQL with SSL for production
7. **Secrets**: Store in Google Secret Manager, not environment variables

---

## Scaling

Cloud Run auto-scales based on traffic:

```bash
# Set minimum instances (avoid cold starts)
gcloud run services update mcp-quendoo-chatbot \
  --region us-central1 \
  --min-instances 1

# Set maximum instances
gcloud run services update mcp-quendoo-chatbot \
  --region us-central1 \
  --max-instances 10

# Set concurrency (requests per container)
gcloud run services update mcp-quendoo-chatbot \
  --region us-central1 \
  --concurrency 80
```

---

## Cost Optimization

**SQLite (cheapest):**
- No database costs
- Good for low-traffic development
- Data lost on container restart

**Cloud SQL (production):**
- db-f1-micro: ~$7/month
- db-g1-small: ~$25/month
- Includes backups and high availability

**Cloud Run:**
- Pay per request
- Free tier: 2 million requests/month
- Typical cost: $0.10-$2/day for small apps

---

## Backup & Recovery

### SQLite backup

```bash
# Download database from running container
gcloud run services describe mcp-quendoo-chatbot \
  --region us-central1 \
  --format="value(status.url)"

# Not practical - use Cloud SQL for production
```

### Cloud SQL backup

```bash
# Automatic backups enabled by default

# Manual backup
gcloud sql backups create --instance=mcp-chatbot-db

# List backups
gcloud sql backups list --instance=mcp-chatbot-db

# Restore from backup
gcloud sql backups restore BACKUP_ID --instance=mcp-chatbot-db
```

---

## Next Steps

1. ✅ Deploy MCP server to Cloud Run
2. ✅ Create tenants via `/admin/tenants`
3. ✅ Save Quendoo API keys via `/admin/api-keys`
4. ✅ Test connection via `/mcp/connect`
5. ✅ Test tool execution via `/mcp/tools/execute`
6. ✅ Integrate Dashboard backend (Node.js)
7. ✅ Test end-to-end from Dashboard UI
8. 🔄 Add authentication to admin endpoints
9. 🔄 Set up monitoring and alerts
10. 🔄 Configure production database (Cloud SQL)
