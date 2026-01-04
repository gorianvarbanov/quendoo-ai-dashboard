"""
MCP Quendoo Chatbot - Main FastAPI Application

Multi-tenant MCP server for Quendoo hotel management system
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database.connection import init_db
from app.api import mcp_routes, admin_routes, sse_mcp_routes

settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="MCP Quendoo Chatbot",
    description="Multi-tenant MCP server for Quendoo hotel management system integration with AI chatbots",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(mcp_routes.router)
app.include_router(admin_routes.router)
app.include_router(sse_mcp_routes.router)  # SSE-based MCP protocol


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("[App] Starting MCP Quendoo Chatbot...")
    print(f"[App] Database: {settings.DATABASE_URL}")
    init_db()
    print("[App] Ready to accept connections!")


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "MCP Quendoo Chatbot",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "mcp": [
                "POST /mcp/connect",
                "POST /mcp/tools/execute",
                "POST /mcp/disconnect",
                "GET /mcp/tools/list",
                "GET /mcp/connections"
            ],
            "admin": [
                "POST /admin/tenants",
                "GET /admin/tenants/{tenant_id}",
                "GET /admin/tenants",
                "POST /admin/api-keys",
                "GET /admin/api-keys/{tenant_id}",
                "DELETE /admin/api-keys/{tenant_id}/{key_name}"
            ]
        },
        "documentation": "/docs"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "mcp-quendoo-chatbot",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
