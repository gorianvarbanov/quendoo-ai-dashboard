"""
Admin endpoints for API key management and tenant management
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.tenant import (
    TenantCreate,
    TenantResponse,
    ApiKeyCreate,
    ApiKeyResponse
)
from app.database import (
    create_tenant,
    get_tenant,
    list_tenants,
    create_api_key,
    list_api_keys,
    delete_api_key
)
from app.database.connection import get_db_dependency

router = APIRouter(prefix="/admin", tags=["admin"])


# Tenant Management

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant_endpoint(tenant: TenantCreate, db: Session = Depends(get_db_dependency)):
    """
    Create a new tenant (hotel)

    Example:
        POST /admin/tenants
        {
            "tenant_id": "hotel-abc-123",
            "name": "Grand Hotel Sofia"
        }
    """
    try:
        # Check if tenant already exists
        existing = get_tenant(db, tenant.tenant_id)
        if existing:
            raise HTTPException(status_code=400, detail=f"Tenant already exists: {tenant.tenant_id}")

        new_tenant = create_tenant(db, tenant.tenant_id, tenant.name)
        return TenantResponse.from_orm(new_tenant)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {str(e)}")


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant_endpoint(tenant_id: str, db: Session = Depends(get_db_dependency)):
    """
    Get tenant by ID

    Example:
        GET /admin/tenants/hotel-abc-123
    """
    tenant = get_tenant(db, tenant_id)

    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {tenant_id}")

    return TenantResponse.from_orm(tenant)


@router.get("/tenants")
async def list_tenants_endpoint(limit: int = 100, db: Session = Depends(get_db_dependency)):
    """
    List all tenants

    Example:
        GET /admin/tenants?limit=50
    """
    tenants = list_tenants(db, limit=limit)
    return {
        "tenants": [TenantResponse.from_orm(t) for t in tenants],
        "total": len(tenants)
    }


# API Key Management

@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key_endpoint(api_key: ApiKeyCreate, db: Session = Depends(get_db_dependency)):
    """
    Create or update an API key for a tenant (encrypted storage)

    Example:
        POST /admin/api-keys
        {
            "tenant_id": "hotel-abc-123",
            "key_name": "QUENDOO_API_KEY",
            "key_value": "sk-quendoo-xxxxx"
        }

        Response:
        {
            "id": "uuid-...",
            "tenant_id": "hotel-abc-123",
            "key_name": "QUENDOO_API_KEY",
            "created_at": "2026-01-04T10:00:00Z",
            "updated_at": "2026-01-04T10:00:00Z"
        }

    Note: key_value is NOT returned for security
    """
    try:
        # Verify tenant exists
        tenant = get_tenant(db, api_key.tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant not found: {api_key.tenant_id}")

        # Create/update API key (will be encrypted)
        new_key = create_api_key(db, api_key.tenant_id, api_key.key_name, api_key.key_value)

        return ApiKeyResponse.from_orm(new_key)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {str(e)}")


@router.get("/api-keys/{tenant_id}")
async def list_api_keys_endpoint(tenant_id: str, db: Session = Depends(get_db_dependency)):
    """
    List API keys for a tenant (without decrypted values)

    Example:
        GET /admin/api-keys/hotel-abc-123

        Response:
        {
            "tenant_id": "hotel-abc-123",
            "keys": [
                {
                    "id": "uuid-...",
                    "tenant_id": "hotel-abc-123",
                    "key_name": "QUENDOO_API_KEY",
                    "created_at": "2026-01-04T10:00:00Z",
                    "updated_at": "2026-01-04T10:00:00Z"
                }
            ],
            "total": 1
        }
    """
    # Verify tenant exists
    tenant = get_tenant(db, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {tenant_id}")

    keys = list_api_keys(db, tenant_id)

    return {
        "tenant_id": tenant_id,
        "keys": [ApiKeyResponse.from_orm(k) for k in keys],
        "total": len(keys)
    }


@router.delete("/api-keys/{tenant_id}/{key_name}")
async def delete_api_key_endpoint(tenant_id: str, key_name: str, db: Session = Depends(get_db_dependency)):
    """
    Delete an API key for a tenant

    Example:
        DELETE /admin/api-keys/hotel-abc-123/QUENDOO_API_KEY

        Response:
        {
            "success": true,
            "tenant_id": "hotel-abc-123",
            "key_name": "QUENDOO_API_KEY"
        }
    """
    success = delete_api_key(db, tenant_id, key_name)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"API key not found: {key_name} for tenant {tenant_id}"
        )

    return {
        "success": True,
        "tenant_id": tenant_id,
        "key_name": key_name
    }
