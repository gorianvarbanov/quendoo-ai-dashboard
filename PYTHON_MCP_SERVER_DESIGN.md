# New Python MCP Server for Quendoo Dashboard

## Архитектура

**Standalone Python MCP сървър** с multi-tenant support и Quendoo API integration.

```
┌────────────────────────────────────────────────────────────────┐
│              Quendoo AI Dashboard (Vue.js)                      │
│              - Chat interface                                   │
│              - User authentication                              │
└────────────────────┬───────────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ▼
┌────────────────────────────────────────────────────────────────┐
│         Dashboard Backend (Node.js/Express)                     │
│                                                                │
│  - User authentication (JWT)                                   │
│  - Conversation management (Firestore)                         │
│  - Claude API integration                                      │
│  - Forwards tool calls to MCP Server                           │
└────────────────────┬───────────────────────────────────────────┘
                     │ HTTP/SSE
                     ▼
┌────────────────────────────────────────────────────────────────┐
│         NEW: Python MCP Server (FastAPI)                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Multi-Tenant Manager                                    │ │
│  │  - Connection tracking (connection_id → tenant_id)       │ │
│  │  - Tenant context per request                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Database (SQLite/PostgreSQL)                            │ │
│  │  - tenants (id, name, created_at)                        │ │
│  │  - users (id, email, tenant_id)                          │ │
│  │  - api_keys (tenant_id, encrypted_quendoo_key)           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Quendoo Tools (11+ tools)                               │ │
│  │  - get_property_settings()                               │ │
│  │  - get_rooms_details()                                   │ │
│  │  - get_availability()                                    │ │
│  │  - update_availability()                                 │ │
│  │  - get_bookings()                                        │ │
│  │  - get_booking_offers()                                  │ │
│  │  - ack_booking()                                         │ │
│  │  - post_room_assignment()                                │ │
│  │  ... (uses tenant's API key)                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────┬───────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌────────────────────────────────────────────────────────────────┐
│            Quendoo PMS API                                      │
│            platform.quendoo.com/api/pms/v1                      │
└────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
quendoo-mcp-server/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app + MCP protocol
│   ├── config.py                  # Configuration
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── tenant.py              # Tenant, User models
│   │   └── api_key.py             # ApiKey model
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── connection.py          # DB connection
│   │   ├── crud.py                # CRUD operations
│   │   └── encryption.py          # API key encryption
│   │
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── protocol.py            # MCP protocol implementation
│   │   ├── tool_registry.py       # Tool definitions
│   │   └── tool_executor.py       # Tool execution logic
│   │
│   ├── quendoo/
│   │   ├── __init__.py
│   │   ├── client.py              # Quendoo API client
│   │   └── tools.py               # Quendoo-specific tool implementations
│   │
│   └── auth/
│       ├── __init__.py
│       └── jwt_validator.py       # JWT token validation
│
├── migrations/                     # Alembic migrations
│   └── versions/
│
├── tests/
│   ├── test_mcp_protocol.py
│   ├── test_quendoo_tools.py
│   └── test_multitenant.py
│
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

---

## Core Components

### 1. Models (app/models/tenant.py)

```python
"""
Data models for multi-tenant support
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class TenantDB(Base):
    """Tenant database model"""
    __tablename__ = "tenants"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("UserDB", back_populates="tenant")
    api_keys = relationship("ApiKeyDB", back_populates="tenant")


class UserDB(Base):
    """User database model"""
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tenant = relationship("TenantDB", back_populates="users")


class ApiKeyDB(Base):
    """Encrypted API key storage"""
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    key_name = Column(String, nullable=False)  # e.g., "QUENDOO_API_KEY"
    encrypted_value = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = relationship("TenantDB", back_populates="api_keys")

    __table_args__ = (
        UniqueConstraint("tenant_id", "key_name", name="uq_tenant_key"),
    )


# Pydantic models for API
class Tenant(BaseModel):
    """Tenant schema"""
    id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class User(BaseModel):
    """User schema"""
    id: str
    email: EmailStr
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKey(BaseModel):
    """API key schema (without encrypted value)"""
    id: str
    tenant_id: str
    key_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

---

### 2. Database Connection (app/database/connection.py)

```python
"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from app.config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db() -> Session:
    """Database session context manager"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """Initialize database (create tables)"""
    from app.models.tenant import Base
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")
```

---

### 3. CRUD Operations (app/database/crud.py)

```python
"""
Database CRUD operations
"""
from sqlalchemy.orm import Session
from app.models.tenant import TenantDB, UserDB, ApiKeyDB
from app.database.encryption import encrypt_value, decrypt_value
from typing import Optional
import uuid


def get_tenant_by_id(db: Session, tenant_id: str) -> Optional[TenantDB]:
    """Get tenant by ID"""
    return db.query(TenantDB).filter(TenantDB.id == tenant_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[UserDB]:
    """Get user by email"""
    return db.query(UserDB).filter(UserDB.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[UserDB]:
    """Get user by ID"""
    return db.query(UserDB).filter(UserDB.id == user_id).first()


def create_tenant(db: Session, name: str) -> TenantDB:
    """Create new tenant"""
    tenant = TenantDB(
        id=str(uuid.uuid4()),
        name=name,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def create_user(db: Session, email: str, tenant_id: str) -> UserDB:
    """Create new user"""
    user = UserDB(
        id=str(uuid.uuid4()),
        email=email,
        tenant_id=tenant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def save_api_key(db: Session, tenant_id: str, key_name: str, key_value: str) -> ApiKeyDB:
    """Save or update encrypted API key"""
    # Check if key exists
    api_key = db.query(ApiKeyDB).filter(
        ApiKeyDB.tenant_id == tenant_id,
        ApiKeyDB.key_name == key_name
    ).first()

    encrypted_value = encrypt_value(key_value)

    if api_key:
        # Update existing
        api_key.encrypted_value = encrypted_value
        api_key.is_active = True
    else:
        # Create new
        api_key = ApiKeyDB(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            key_name=key_name,
            encrypted_value=encrypted_value,
            is_active=True,
        )
        db.add(api_key)

    db.commit()
    db.refresh(api_key)
    return api_key


def get_api_key(db: Session, tenant_id: str, key_name: str) -> Optional[str]:
    """Get decrypted API key"""
    api_key = db.query(ApiKeyDB).filter(
        ApiKeyDB.tenant_id == tenant_id,
        ApiKeyDB.key_name == key_name,
        ApiKeyDB.is_active == True
    ).first()

    if not api_key:
        return None

    try:
        return decrypt_value(api_key.encrypted_value)
    except Exception as e:
        print(f"Error decrypting API key: {e}")
        return None


def list_api_keys(db: Session, tenant_id: str) -> list[ApiKeyDB]:
    """List all active API keys for tenant (without decrypted values)"""
    return db.query(ApiKeyDB).filter(
        ApiKeyDB.tenant_id == tenant_id,
        ApiKeyDB.is_active == True
    ).all()


def delete_api_key(db: Session, tenant_id: str, key_name: str) -> bool:
    """Soft delete API key"""
    api_key = db.query(ApiKeyDB).filter(
        ApiKeyDB.tenant_id == tenant_id,
        ApiKeyDB.key_name == key_name
    ).first()

    if not api_key:
        return False

    api_key.is_active = False
    db.commit()
    return True
```

---

### 4. Encryption (app/database/encryption.py)

```python
"""
API key encryption using Fernet (AES-256-GCM)
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
from app.config import settings


class EncryptionManager:
    """Handles encryption/decryption of sensitive data"""

    def __init__(self, master_key: str):
        # Derive encryption key from master key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"quendoo_mcp_salt_v1",
            iterations=100000,
        )
        derived_key = kdf.derive(master_key.encode())
        key = base64.urlsafe_b64encode(derived_key)
        self.cipher = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext and return base64 encoded ciphertext"""
        if not plaintext:
            raise ValueError("Plaintext cannot be empty")

        encrypted_bytes = self.cipher.encrypt(plaintext.encode())
        return encrypted_bytes.decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext and return plaintext"""
        if not ciphertext:
            raise ValueError("Ciphertext cannot be empty")

        try:
            decrypted_bytes = self.cipher.decrypt(ciphertext.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")


# Singleton instance
_encryption_manager = None


def get_encryption_manager() -> EncryptionManager:
    """Get encryption manager singleton"""
    global _encryption_manager
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager(settings.ENCRYPTION_KEY)
    return _encryption_manager


def encrypt_value(plaintext: str) -> str:
    """Encrypt a value"""
    return get_encryption_manager().encrypt(plaintext)


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a value"""
    return get_encryption_manager().decrypt(ciphertext)
```

---

### 5. Multi-Tenant MCP Server (app/mcp/protocol.py)

```python
"""
Multi-tenant MCP Server implementation
"""
from typing import Dict, Optional, Any
from datetime import datetime
import uuid
from fastapi import HTTPException
from app.database.connection import get_db
from app.database.crud import get_api_key
from app.quendoo.tools import execute_quendoo_tool


class MultitenantMCPServer:
    """
    Multi-tenant MCP server that handles tool execution with tenant context
    """

    def __init__(self):
        # Track active connections: connection_id -> tenant_id
        self.connections: Dict[str, str] = {}

        # Track connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}

    def register_connection(self, tenant_id: str) -> str:
        """
        Register a new connection for a tenant

        Returns:
            connection_id: Unique connection identifier
        """
        connection_id = str(uuid.uuid4())

        self.connections[connection_id] = tenant_id
        self.connection_metadata[connection_id] = {
            "tenant_id": tenant_id,
            "connected_at": datetime.utcnow(),
            "tool_calls": 0,
        }

        print(f"✓ Connection registered: {connection_id} → Tenant: {tenant_id}")
        return connection_id

    def unregister_connection(self, connection_id: str):
        """Unregister a connection"""
        if connection_id in self.connections:
            tenant_id = self.connections[connection_id]
            metadata = self.connection_metadata.get(connection_id, {})
            tool_calls = metadata.get("tool_calls", 0)

            del self.connections[connection_id]
            del self.connection_metadata[connection_id]

            print(f"✓ Connection closed: {connection_id} (Tenant: {tenant_id}, Tool calls: {tool_calls})")

    def get_tenant_id(self, connection_id: str) -> Optional[str]:
        """Get tenant ID for a connection"""
        return self.connections.get(connection_id)

    async def handle_tool_call(
        self,
        connection_id: str,
        tool_name: str,
        tool_args: dict
    ) -> dict:
        """
        Handle a tool call with tenant context

        Args:
            connection_id: Connection identifier
            tool_name: Name of the tool to execute
            tool_args: Tool arguments

        Returns:
            Tool execution result

        Raises:
            HTTPException: If tenant not found or API key not configured
        """
        # Get tenant ID for this connection
        tenant_id = self.get_tenant_id(connection_id)

        if not tenant_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid connection ID or connection expired"
            )

        # Update tool call counter
        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id]["tool_calls"] += 1

        print(f"[Tool Call] Tenant: {tenant_id}, Tool: {tool_name}, Args: {tool_args}")

        # Get tenant's Quendoo API key from database
        with get_db() as db:
            quendoo_api_key = get_api_key(db, tenant_id, "QUENDOO_API_KEY")

        if not quendoo_api_key:
            raise HTTPException(
                status_code=400,
                detail=f"QUENDOO_API_KEY not configured for tenant {tenant_id}. "
                       "Please add it via the dashboard."
            )

        # Execute tool with tenant's API key
        try:
            result = await execute_quendoo_tool(
                tool_name=tool_name,
                tool_args=tool_args,
                api_key=quendoo_api_key
            )

            print(f"✓ Tool executed successfully: {tool_name}")
            return result

        except Exception as e:
            print(f"✗ Tool execution failed: {tool_name} - {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Tool execution failed: {str(e)}"
            )


# Singleton instance
mcp_server = MultitenantMCPServer()
```

---

### 6. Quendoo API Client (app/quendoo/client.py)

```python
"""
Quendoo PMS API client
"""
import httpx
from typing import Dict, Any, Optional

DEFAULT_BASE_URL = "https://www.platform.quendoo.com/api/pms/v1"


class QuendooClient:
    """HTTP client for Quendoo PMS API"""

    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL, api_lng: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.default_lang = api_lng

    def _build_params(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Build query parameters with API key"""
        params = {"api_key": self.api_key}

        if self.default_lang:
            params["api_lng"] = self.default_lang

        if extra:
            params.update({k: v for k, v in extra.items() if v is not None})

        return params

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """GET request to Quendoo API"""
        url = f"{self.base_url}{path}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(url, params=self._build_params(params))
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(
                    f"Quendoo API request failed: {e.response.status_code} {e.response.text}"
                )

    async def post(
        self,
        path: str,
        json: Any = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """POST request to Quendoo API"""
        url = f"{self.base_url}{path}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    url,
                    params=self._build_params(params),
                    json=json or {}
                )
                response.raise_for_status()
                return response.json() if response.content else {"status": response.status_code}
            except httpx.HTTPStatusError as e:
                raise RuntimeError(
                    f"Quendoo API request failed: {e.response.status_code} {e.response.text}"
                )
```

---

### 7. Quendoo Tools Implementation (app/quendoo/tools.py)

```python
"""
Quendoo tool implementations
Maps tool calls to Quendoo API endpoints
"""
from typing import Dict, Any
from app.quendoo.client import QuendooClient


async def execute_quendoo_tool(tool_name: str, tool_args: dict, api_key: str) -> dict:
    """
    Execute a Quendoo tool with the given API key

    Args:
        tool_name: Name of the tool
        tool_args: Tool arguments
        api_key: Tenant's Quendoo API key

    Returns:
        Tool execution result
    """
    client = QuendooClient(api_key=api_key)

    # Map tool name to implementation
    if tool_name == "get_property_settings":
        return await client.get("/Property/getPropertySettings", params={
            "api_lng": tool_args.get("api_lng"),
            "names": tool_args.get("names"),
        })

    elif tool_name == "get_rooms_details":
        return await client.get("/Property/getRoomsDetails", params={
            "api_lng": tool_args.get("api_lng"),
            "room_id": tool_args.get("room_id"),
        })

    elif tool_name == "get_availability":
        return await client.get("/Availability/getAvailability", params={
            "date_from": tool_args["date_from"],
            "date_to": tool_args["date_to"],
            "sysres": tool_args["sysres"],
        })

    elif tool_name == "update_availability":
        return await client.post("/Availability/updateAvailability", json={
            "values": tool_args["values"]
        })

    elif tool_name == "get_bookings":
        return await client.get("/Booking/getBookings")

    elif tool_name == "get_booking_offers":
        return await _get_booking_offers(client, tool_args)

    elif tool_name == "ack_booking":
        return await client.post("/Booking/ackBooking", json={
            "revision_id": tool_args["revision_id"],
            "booking_items": tool_args.get("booking_items"),
        })

    elif tool_name == "post_room_assignment":
        return await client.post("/Booking/postRoomAssignment", json={
            "items": tool_args["items"]
        })

    else:
        raise ValueError(f"Unknown tool: {tool_name}")


async def _get_booking_offers(client: QuendooClient, args: dict) -> dict:
    """Get booking offers with auto-detection of booking module"""
    bm_code = args.get("bm_code")

    # Auto-detect booking module if not provided
    if not bm_code:
        settings = await client.get("/Property/getPropertySettings", params={"names": "booking_modules"})
        booking_modules = settings.get("data", {}).get("booking_modules", [])

        if booking_modules:
            bm_code = booking_modules[0]["code"]
            print(f"[Quendoo] Auto-detected booking module: {bm_code}")
        else:
            raise ValueError("No booking modules found. Please configure in Quendoo.")

    return await client.get("/Property/getBookingOffers", params={
        "bm_code": bm_code,
        "date_from": args["date_from"],
        "nights": args["nights"],
        "api_lng": args.get("api_lng"),
        "guests": args.get("guests"),
        "currency": args.get("currency"),
    })
```

---

### 8. FastAPI Main App (app/main.py)

```python
"""
FastAPI application with MCP protocol endpoints
"""
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import jwt
from datetime import datetime

from app.config import settings
from app.database.connection import init_db, get_db
from app.database import crud
from app.mcp.protocol import mcp_server

# Initialize FastAPI app
app = FastAPI(
    title="Quendoo MCP Server",
    description="Multi-tenant MCP server for Quendoo Dashboard",
    version="1.0.0"
)


# Pydantic models for API
class ToolCallRequest(BaseModel):
    """Tool call request"""
    tool_name: str
    tool_args: Dict[str, Any]
    connection_id: str


class ConnectionResponse(BaseModel):
    """Connection registration response"""
    connection_id: str
    tenant_id: str
    message: str


@app.on_event("startup")
async def startup():
    """Initialize database on startup"""
    init_db()
    print("✓ Quendoo MCP Server started")


def verify_jwt_token(token: str) -> Optional[str]:
    """
    Verify JWT token and extract tenant_id

    Returns:
        tenant_id if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("tenantId")
    except jwt.InvalidTokenError:
        return None


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Quendoo MCP Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "connect": "POST /mcp/connect",
            "tools": "POST /mcp/tools/execute",
            "health": "GET /health"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_connections": len(mcp_server.connections)
    }


@app.post("/mcp/connect", response_model=ConnectionResponse)
async def connect(authorization: Optional[str] = Header(None)):
    """
    Register a new MCP connection for a tenant

    Requires JWT token in Authorization header
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.replace("Bearer ", "")
    tenant_id = verify_jwt_token(token)

    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Verify tenant exists
    with get_db() as db:
        tenant = crud.get_tenant_by_id(db, tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

    # Register connection
    connection_id = mcp_server.register_connection(tenant_id)

    return ConnectionResponse(
        connection_id=connection_id,
        tenant_id=tenant_id,
        message="Connection registered successfully"
    )


@app.post("/mcp/tools/execute")
async def execute_tool(request: ToolCallRequest):
    """
    Execute a tool with tenant context

    Requires connection_id from /mcp/connect
    """
    try:
        result = await mcp_server.handle_tool_call(
            connection_id=request.connection_id,
            tool_name=request.tool_name,
            tool_args=request.tool_args
        )

        return {
            "status": "success",
            "tool_name": request.tool_name,
            "result": result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/mcp/disconnect")
async def disconnect(connection_id: str):
    """Disconnect and unregister a connection"""
    mcp_server.unregister_connection(connection_id)
    return {"status": "disconnected"}


# Admin endpoints for API key management
@app.post("/admin/api-keys")
async def save_api_key(
    key_name: str,
    key_value: str,
    authorization: Optional[str] = Header(None)
):
    """Save/update API key for tenant"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.replace("Bearer ", "")
    tenant_id = verify_jwt_token(token)

    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        api_key = crud.save_api_key(db, tenant_id, key_name, key_value)

    return {
        "status": "success",
        "message": f"API key '{key_name}' saved successfully"
    }


@app.get("/admin/api-keys")
async def list_api_keys(authorization: Optional[str] = Header(None)):
    """List API keys for tenant (without decrypted values)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.replace("Bearer ", "")
    tenant_id = verify_jwt_token(token)

    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        keys = crud.list_api_keys(db, tenant_id)

    return {
        "keys": [
            {
                "key_name": key.key_name,
                "is_active": key.is_active,
                "created_at": key.created_at.isoformat(),
                "updated_at": key.updated_at.isoformat()
            }
            for key in keys
        ]
    }


@app.delete("/admin/api-keys/{key_name}")
async def delete_api_key(key_name: str, authorization: Optional[str] = Header(None)):
    """Delete API key for tenant"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.replace("Bearer ", "")
    tenant_id = verify_jwt_token(token)

    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db() as db:
        success = crud.delete_api_key(db, tenant_id, key_name)

    if not success:
        raise HTTPException(status_code=404, detail=f"API key '{key_name}' not found")

    return {
        "status": "success",
        "message": f"API key '{key_name}' deleted successfully"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(settings.PORT),
        reload=settings.DEBUG
    )
```

---

### 9. Configuration (app/config.py)

```python
"""
Configuration management
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    # Server
    PORT: int = 8000
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./quendoo_mcp.db"

    # Security
    JWT_SECRET: str
    ENCRYPTION_KEY: str

    # Quendoo API (default, can be overridden per tenant)
    QUENDOO_BASE_URL: str = "https://www.platform.quendoo.com/api/pms/v1"

    class Config:
        env_file = ".env"


settings = Settings()
```

---

### 10. Requirements (requirements.txt)

```txt
fastapi==0.110.0
uvicorn[standard]==0.27.0
pydantic==2.6.0
pydantic-settings==2.1.0
sqlalchemy==2.0.25
alembic==1.13.1
httpx==0.26.0
cryptography==42.0.0
pyjwt==2.8.0
python-multipart==0.0.6
```

---

## How to Use

### 1. Setup

```bash
# Create project
mkdir quendoo-mcp-server
cd quendoo-mcp-server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env <<EOF
DATABASE_URL=sqlite:///./quendoo_mcp.db
JWT_SECRET=your-jwt-secret-here-32-characters
ENCRYPTION_KEY=your-encryption-key-32-characters
PORT=8000
DEBUG=true
EOF
```

### 2. Run Server

```bash
# Development
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Connect from Dashboard

**Dashboard Backend (Node.js):**

```javascript
// Connect to MCP server
const connectToMCP = async (tenantId, jwtToken) => {
  const response = await axios.post('http://localhost:8000/mcp/connect', null, {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  const { connection_id } = response.data;
  return connection_id;
};

// Execute tool
const executeTool = async (connectionId, toolName, toolArgs) => {
  const response = await axios.post('http://localhost:8000/mcp/tools/execute', {
    connection_id: connectionId,
    tool_name: toolName,
    tool_args: toolArgs
  });

  return response.data.result;
};
```

---

## Deployment

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Deploy to Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/quendoo-mcp-server

# Deploy
gcloud run deploy quendoo-mcp-server \
  --image gcr.io/PROJECT_ID/quendoo-mcp-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars JWT_SECRET=xxx,ENCRYPTION_KEY=xxx
```

---

## Next Steps

1. **Create project structure**
2. **Implement models and database**
3. **Implement MCP protocol**
4. **Implement Quendoo tools**
5. **Test locally**
6. **Deploy to Cloud Run**
7. **Integrate with Dashboard**

Готов ли си да започнем? 🚀
