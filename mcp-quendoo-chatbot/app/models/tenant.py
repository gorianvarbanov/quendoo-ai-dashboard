"""
Database models for tenants, users, and API keys
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel, Field

Base = declarative_base()


class Tenant(Base):
    """Tenant (hotel) model - each hotel is a separate tenant"""
    __tablename__ = "tenants"

    tenant_id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="tenant", cascade="all, delete-orphan")


class User(Base):
    """User model - users belong to tenants"""
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id"), nullable=False)
    username = Column(String(255), nullable=False, unique=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")


class ApiKey(Base):
    """API Key model - encrypted storage of API keys per tenant"""
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, index=True)
    tenant_id = Column(String(36), ForeignKey("tenants.tenant_id"), nullable=False)
    key_name = Column(String(100), nullable=False)  # e.g., "QUENDOO_API_KEY"
    encrypted_value = Column(Text, nullable=False)  # Fernet-encrypted value
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tenant = relationship("Tenant", back_populates="api_keys")


# Pydantic models for API requests/responses

class TenantCreate(BaseModel):
    """Request model for creating a tenant"""
    tenant_id: str = Field(..., min_length=1, max_length=36)
    name: str = Field(..., min_length=1, max_length=255)


class TenantResponse(BaseModel):
    """Response model for tenant data"""
    tenant_id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApiKeyCreate(BaseModel):
    """Request model for creating/updating an API key"""
    tenant_id: str = Field(..., min_length=1)
    key_name: str = Field(..., min_length=1, max_length=100)
    key_value: str = Field(..., min_length=1)  # Plain text, will be encrypted


class ApiKeyResponse(BaseModel):
    """Response model for API key (without decrypted value)"""
    id: str
    tenant_id: str
    key_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConnectionRequest(BaseModel):
    """Request model for establishing MCP connection"""
    tenant_id: str
    user_id: Optional[str] = None
    metadata: Optional[dict] = None


class ConnectionResponse(BaseModel):
    """Response model for MCP connection"""
    connection_id: str
    tenant_id: str
    created_at: datetime


class ToolExecuteRequest(BaseModel):
    """Request model for executing a tool"""
    connection_id: str
    tool_name: str
    tool_args: dict = Field(default_factory=dict)


class ToolExecuteResponse(BaseModel):
    """Response model for tool execution"""
    connection_id: str
    tool_name: str
    result: dict
    error: Optional[str] = None
