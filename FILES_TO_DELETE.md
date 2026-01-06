# Files to Delete - Cleanup Plan

## Root Directory Files (Unused)

### PHP/Composer Files (Not Used):
- `composer.phar` - PHP Composer binary (3.3 MB, not needed)
- `composer-setup.php` - PHP Composer setup script
- `test-mcp.php` - Old PHP test file

### Temporary/Test Files:
- `C:tempbackend-logs.json` - Malformed temp file
- `nul` - Empty file
- `test-integration.html` - Old HTML test file

### Documentation Files (Can be archived/deleted):
Multiple planning documents that are now obsolete:
- `CLAUDE_API_SETUP.md` - Initial setup notes
- `DASHBOARD_MCP_INTEGRATION.md` - Old integration planning
- `DEPLOYMENT_GUIDE.md` - Outdated deployment instructions
- `IMPLEMENTATION_COMPLETE.md` - Old implementation notes
- `INTEGRATION_ANALYSIS.md` - Planning document
- `MCP_CLIENT_STRATEGY.md` - Strategy document
- `MCP_DASHBOARD_INTEGRATION_ARCHITECTURE.md` - Old architecture
- `MULTI_TENANT_IMPLEMENTATION_PLAN.md` - Planning document
- `NEW_MCP_SERVER_PLAN.md` - Planning document
- `PYTHON_MCP_SERVER_DESIGN.md` - Design document
- `QUENDOO_INTEGRATION.md` - Integration notes
- `SETTINGS_FEATURE_COMPLETE.md` - Feature completion notes
- `project plan.txt` - Old project plan

**Keep:**
- `README.md` - Main project README
- `ARCHITECTURE.md` - NEW architecture overview (just created)

---

## Backend Directory - OLD PHP Backend (Entire Directory Unused)

**Delete entire PHP backend:**
```
backend/
├── .env                    # Old PHP environment
├── .htaccess              # Apache config
├── composer.json          # PHP dependencies
├── composer.lock          # PHP lock file
├── public/                # PHP public directory
│   └── index.php
├── src/                   # PHP source code
│   ├── bootstrap.php
│   ├── Controllers/
│   ├── Middleware/
│   ├── Services/
│   ├── Storage/
│   └── Utils/
├── storage/               # PHP storage directory
└── vendor/                # PHP vendor directory (large!)
```

**KEEP ONLY:**
```
backend/
├── mcp-client/           # Node.js backend (ACTIVE)
├── QUENDOO_MCP_CONFIGURATION.md  # Useful config reference
└── README.md             # Backend README
```

---

## MCP Server Directory - Unused Files

**In `mcp-quendoo-chatbot/`:**

### Unused Server Files:
- `fastmcp_server.py` - Standalone server (not used, Docker uses app/main.py)
- `hybrid_server.py` - Old hybrid server implementation

### Database Files (Can be deleted or gitignored):
- `chatbot.db` - SQLite database (45 KB, not needed in repo)

### Test/Documentation (Can be deleted):
- `SUCCESS_REPORT.md` - Old success report
- `TEST_RESULTS.md` - Test results document
- `DEPLOYMENT_GUIDE.md` - Deployment guide (info now in ARCHITECTURE.md)

### Keep:
- `app/` directory - Active Python application
- `tests/` directory - Test files
- `.env`, `.env.example`, `.env.production` - Configuration
- `env.yaml` - Cloud Run config (NOTE: Don't use with gcloud deploy)
- `Dockerfile` - Container definition
- `requirements.txt` - Python dependencies
- `README.md` - MCP server docs
- `.gitignore`, `.dockerignore` - Git/Docker ignore files

---

## Size Estimates

**Will free up approximately:**
- `composer.phar`: 3.3 MB
- `backend/vendor/`: ~15-20 MB (PHP dependencies)
- Old documentation: ~500 KB
- Other files: ~100 KB

**Total: ~19-24 MB**

---

## Commands to Execute Cleanup

### 1. Delete root directory files:
```bash
rm composer.phar
rm composer-setup.php
rm test-mcp.php
rm "C:tempbackend-logs.json"
rm nul
rm test-integration.html
```

### 2. Delete old documentation (optional - can archive first):
```bash
rm CLAUDE_API_SETUP.md
rm DASHBOARD_MCP_INTEGRATION.md
rm DEPLOYMENT_GUIDE.md
rm IMPLEMENTATION_COMPLETE.md
rm INTEGRATION_ANALYSIS.md
rm MCP_CLIENT_STRATEGY.md
rm MCP_DASHBOARD_INTEGRATION_ARCHITECTURE.md
rm MULTI_TENANT_IMPLEMENTATION_PLAN.md
rm NEW_MCP_SERVER_PLAN.md
rm PYTHON_MCP_SERVER_DESIGN.md
rm QUENDOO_INTEGRATION.md
rm SETTINGS_FEATURE_COMPLETE.md
rm "project plan.txt"
```

### 3. Delete OLD PHP backend:
```bash
rm -rf backend/public
rm -rf backend/src
rm -rf backend/storage
rm -rf backend/vendor
rm backend/.env
rm backend/.htaccess
rm backend/composer.json
rm backend/composer.lock
```

### 4. Delete unused MCP server files:
```bash
cd mcp-quendoo-chatbot
rm fastmcp_server.py
rm hybrid_server.py
rm chatbot.db
rm SUCCESS_REPORT.md
rm TEST_RESULTS.md
rm DEPLOYMENT_GUIDE.md
```

### 5. Update .gitignore:
Add to `.gitignore`:
```
# Python
__pycache__/
*.pyc
*.pyo
*.db

# Temp files
nul
*.log
```

---

## Final Project Structure (After Cleanup)

```
quendoo-ai-dashboard/
├── .git/
├── .gitignore
├── .firebaserc
├── firebase.json
├── ARCHITECTURE.md          # NEW: Architecture documentation
├── README.md                # Main project README
│
├── frontend/               # Vue 3 frontend (ACTIVE)
│   ├── src/
│   ├── public/
│   ├── dist/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── mcp-client/         # Node.js backend (ACTIVE)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── .env
│   │   └── Dockerfile
│   ├── QUENDOO_MCP_CONFIGURATION.md
│   └── README.md
│
└── mcp-quendoo-chatbot/   # Python MCP server (ACTIVE)
    ├── app/
    ├── tests/
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.production
    └── README.md
```

---

## Notes

1. **Before deleting**, make sure to commit current changes to Git
2. **PHP backend** is completely unused - Node.js backend is active
3. **fastmcp_server.py** and **hybrid_server.py** are not loaded by Dockerfile
4. All **planning documents** can be safely deleted (info is in ARCHITECTURE.md)
5. Consider creating a `/docs/archive/` folder for old planning docs instead of deleting

---

## Safe Deletion Verification

To verify files are not used, check:

```bash
# Check if PHP files are referenced
grep -r "composer.phar" --exclude-dir=.git .
grep -r "test-mcp.php" --exclude-dir=.git .

# Check if old backend is referenced
grep -r "backend/public" --exclude-dir=.git .
grep -r "backend/src" --exclude-dir=.git .

# Check if old server files are referenced
grep -r "fastmcp_server.py" mcp-quendoo-chatbot/
grep -r "hybrid_server.py" mcp-quendoo-chatbot/
```
