"""
CRUD operations for tenants, users, and API keys
"""
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.tenant import Tenant, User, ApiKey
from app.database.encryption import encrypt_value, decrypt_value


# Tenant operations

def create_tenant(db: Session, tenant_id: str, name: str) -> Tenant:
    """
    Create a new tenant

    Args:
        db: Database session
        tenant_id: Unique tenant identifier
        name: Tenant name (hotel name)

    Returns:
        Created Tenant object
    """
    tenant = Tenant(tenant_id=tenant_id, name=name)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def get_tenant(db: Session, tenant_id: str) -> Optional[Tenant]:
    """
    Get tenant by ID

    Args:
        db: Database session
        tenant_id: Tenant identifier

    Returns:
        Tenant object or None if not found
    """
    return db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()


def list_tenants(db: Session, limit: int = 100) -> List[Tenant]:
    """
    List all tenants

    Args:
        db: Database session
        limit: Maximum number of tenants to return

    Returns:
        List of Tenant objects
    """
    return db.query(Tenant).limit(limit).all()


# User operations

def create_user(db: Session, user_id: str, tenant_id: str, username: str, email: Optional[str] = None) -> User:
    """
    Create a new user

    Args:
        db: Database session
        user_id: Unique user identifier
        tenant_id: Tenant this user belongs to
        username: Username
        email: User email (optional)

    Returns:
        Created User object
    """
    user = User(user_id=user_id, tenant_id=tenant_id, username=username, email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: str) -> Optional[User]:
    """
    Get user by ID

    Args:
        db: Database session
        user_id: User identifier

    Returns:
        User object or None if not found
    """
    return db.query(User).filter(User.user_id == user_id).first()


# API Key operations

def create_api_key(db: Session, tenant_id: str, key_name: str, key_value: str) -> ApiKey:
    """
    Create or update an API key for a tenant (encrypted)

    Args:
        db: Database session
        tenant_id: Tenant identifier
        key_name: Name of the API key (e.g., "QUENDOO_API_KEY")
        key_value: Plain text API key value (will be encrypted)

    Returns:
        Created/updated ApiKey object
    """
    # Check if key already exists
    existing_key = db.query(ApiKey).filter(
        ApiKey.tenant_id == tenant_id,
        ApiKey.key_name == key_name
    ).first()

    encrypted_value = encrypt_value(key_value)

    if existing_key:
        # Update existing key
        existing_key.encrypted_value = encrypted_value
        db.commit()
        db.refresh(existing_key)
        return existing_key
    else:
        # Create new key
        api_key = ApiKey(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            key_name=key_name,
            encrypted_value=encrypted_value
        )
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        return api_key


def get_api_key(db: Session, tenant_id: str, key_name: str) -> Optional[str]:
    """
    Get decrypted API key value for a tenant

    Args:
        db: Database session
        tenant_id: Tenant identifier
        key_name: Name of the API key

    Returns:
        Decrypted API key value or None if not found
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.tenant_id == tenant_id,
        ApiKey.key_name == key_name
    ).first()

    if api_key:
        return decrypt_value(api_key.encrypted_value)
    return None


def list_api_keys(db: Session, tenant_id: str) -> List[ApiKey]:
    """
    List all API keys for a tenant (without decrypted values)

    Args:
        db: Database session
        tenant_id: Tenant identifier

    Returns:
        List of ApiKey objects (encrypted_value field still encrypted)
    """
    return db.query(ApiKey).filter(ApiKey.tenant_id == tenant_id).all()


def delete_api_key(db: Session, tenant_id: str, key_name: str) -> bool:
    """
    Delete an API key for a tenant

    Args:
        db: Database session
        tenant_id: Tenant identifier
        key_name: Name of the API key to delete

    Returns:
        True if deleted, False if not found
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.tenant_id == tenant_id,
        ApiKey.key_name == key_name
    ).first()

    if api_key:
        db.delete(api_key)
        db.commit()
        return True
    return False
