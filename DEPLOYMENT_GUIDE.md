# Quendoo AI Dashboard - Google Cloud Deployment Guide

Complete guide for deploying your application to Google Cloud Platform using Firebase Hosting (frontend) and Cloud Run (backend).

## Prerequisites

- [x] Google Cloud account with billing enabled
- [x] Firebase CLI installed (`npm install -g firebase-tools`)
- [x] Google Cloud SDK installed (`gcloud`)
- [x] Git repository pushed to GitHub

## Architecture

```
┌─────────────────────────────────────────────┐
│        Firebase Hosting (Frontend)          │
│   https://quendoo-ai-dashboard.web.app     │
│          Vue 3 + Vuetify App                │
└─────────────────┬───────────────────────────┘
                  │ HTTP/HTTPS
                  ↓
┌─────────────────────────────────────────────┐
│      Cloud Run (Backend API)                │
│   https://quendoo-backend-xxx.a.run.app     │
│      Node.js Express + MCP Client           │
└─────────────────┬───────────────────────────┘
                  │ JSON-RPC over SSE
                  ↓
┌─────────────────────────────────────────────┐
│         Quendoo MCP Server                  │
│   https://quendoo-mcp-server-...uc.a.run.app│
└─────────────────────────────────────────────┘
```

## Cost Estimate

### Free Tier Usage
- **Firebase Hosting**: 10GB storage, 360MB/day bandwidth (FREE)
- **Cloud Run**: 2M requests/month, 360K vCPU-seconds/month (FREE)
- **Total**: $0/month for initial usage 🎉

### Beyond Free Tier
- Light usage (< 100 users): ~$5-10/month
- Medium usage (100-1000 users): ~$15-30/month

---

## Step-by-Step Deployment

### Step 1: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login

# Set your Google Cloud project
gcloud config set project quendoo-ai-dashboard
```

### Step 2: Create Firebase Project (If Not Exists)

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: `quendoo-ai-dashboard`
4. Follow the wizard to complete setup

OR use CLI:

```bash
# Create new Firebase project (links to existing GCP project)
firebase projects:create quendoo-ai-dashboard
```

### Step 3: Deploy Backend to Cloud Run

```bash
cd backend/mcp-client

# Build and deploy to Cloud Run
gcloud run deploy quendoo-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PORT=3100 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300

# Note: You'll be prompted to enable required APIs on first deploy
# The command will output your service URL like:
# Service URL: https://quendoo-backend-xxxxx-uc.a.run.app
```

**Important**: Copy the Cloud Run service URL - you'll need it for the frontend!

### Step 4: Configure Frontend Environment

Create production environment file with your Cloud Run backend URL:

```bash
cd ../../frontend

# Create .env.production file
echo "VITE_API_BASE_URL=https://quendoo-backend-xxxxx-uc.a.run.app" > .env.production
```

Replace `https://quendoo-backend-xxxxx-uc.a.run.app` with your actual Cloud Run URL from Step 3.

### Step 5: Build Frontend

```bash
# Still in frontend directory
npm run build
```

This creates optimized production files in `frontend/dist/` directory.

### Step 6: Deploy Frontend to Firebase Hosting

```bash
# Go back to project root
cd ..

# Initialize Firebase (first time only)
firebase init hosting
# Answer prompts:
# - Select: Use an existing project
# - Choose: quendoo-ai-dashboard
# - Public directory: frontend/dist
# - Single-page app: Yes
# - Overwrite index.html: No

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your frontend will be deployed to: `https://quendoo-ai-dashboard.web.app`

### Step 7: Configure Backend Environment Variables

Set environment variables for your Cloud Run backend:

```bash
gcloud run services update quendoo-backend \
  --region us-central1 \
  --set-env-vars CORS_ALLOWED_ORIGINS=https://quendoo-ai-dashboard.web.app,QUENDOO_MCP_URL=https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
```

### Step 8: Update Frontend Settings

After deployment, users need to configure in the Settings page:
1. **Anthropic API Key**: Get from https://console.anthropic.com/
2. **MCP Client URL**: Set to your Cloud Run URL (https://quendoo-backend-xxxxx-uc.a.run.app)
3. **MCP Server URL**: Default is already configured

---

## Continuous Deployment (Optional)

### Auto-deploy Frontend on Git Push

1. Install GitHub Actions or use Firebase GitHub integration
2. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Build
        run: cd frontend && npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: quendoo-ai-dashboard
```

### Auto-deploy Backend on Git Push

Cloud Run can auto-deploy from GitHub:

```bash
gcloud run services update quendoo-backend \
  --region us-central1 \
  --source https://github.com/YOUR-USERNAME/quendoo-ai-dashboard \
  --source-path backend/mcp-client
```

---

## Monitoring and Logs

### View Cloud Run Logs

```bash
# View live logs
gcloud run services logs read quendoo-backend \
  --region us-central1 \
  --follow

# Or visit: https://console.cloud.google.com/run
```

### View Firebase Hosting Stats

Visit: https://console.firebase.google.com/project/quendoo-ai-dashboard/hosting/sites

---

## Custom Domain (Optional)

### Add Custom Domain to Firebase Hosting

```bash
firebase hosting:sites:create your-domain-com
firebase target:apply hosting production your-domain-com
firebase deploy --only hosting:production
```

Then follow instructions in Firebase Console to verify domain ownership.

### Add Custom Domain to Cloud Run

```bash
gcloud run domain-mappings create \
  --service quendoo-backend \
  --domain api.yourdomain.com \
  --region us-central1
```

---

## Troubleshooting

### Issue: CORS errors in browser console

**Solution**: Update Cloud Run CORS_ALLOWED_ORIGINS environment variable:

```bash
gcloud run services update quendoo-backend \
  --region us-central1 \
  --set-env-vars CORS_ALLOWED_ORIGINS=https://quendoo-ai-dashboard.web.app
```

### Issue: Cloud Run cold starts taking too long

**Solution**: Set minimum instances to 1:

```bash
gcloud run services update quendoo-backend \
  --region us-central1 \
  --min-instances 1
```

**Note**: This will increase cost slightly (~$3-5/month) but eliminates cold starts.

### Issue: Firebase deploy fails with "Permission denied"

**Solution**: Re-authenticate:

```bash
firebase logout
firebase login
```

### Issue: Frontend can't connect to backend

**Solution**: Check that:
1. `.env.production` has correct Cloud Run URL
2. Frontend was rebuilt after updating .env.production
3. Cloud Run service allows unauthenticated access
4. CORS is configured correctly on backend

---

## Updating Your Deployment

### Update Backend

```bash
cd backend/mcp-client
gcloud run deploy quendoo-backend \
  --source . \
  --region us-central1
```

### Update Frontend

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

---

## Rollback

### Rollback Backend

```bash
# List revisions
gcloud run revisions list --service quendoo-backend --region us-central1

# Rollback to specific revision
gcloud run services update-traffic quendoo-backend \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

### Rollback Frontend

Firebase keeps deployment history. Visit:
https://console.firebase.google.com/project/quendoo-ai-dashboard/hosting/sites

Click "View" next to a previous deployment and click "Rollback".

---

## Cleanup / Delete

### Delete Cloud Run Service

```bash
gcloud run services delete quendoo-backend --region us-central1
```

### Delete Firebase Hosting Site

```bash
firebase hosting:disable
```

---

## Support and Resources

- **Firebase Documentation**: https://firebase.google.com/docs/hosting
- **Cloud Run Documentation**: https://cloud.google.com/run/docs
- **Google Cloud Console**: https://console.cloud.google.com/
- **Firebase Console**: https://console.firebase.google.com/

---

## Summary

Your Quendoo AI Dashboard is now deployed to production!

- **Frontend**: https://quendoo-ai-dashboard.web.app
- **Backend**: https://quendoo-backend-xxxxx-uc.a.run.app
- **Cost**: Starting at $0/month (free tier)

Users can now access your application, configure their Anthropic API key in Settings, and start chatting with Claude using your MCP tools!
