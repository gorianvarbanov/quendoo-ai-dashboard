"""
Database connection and session management
"""
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import get_settings
from app.models.tenant import Base

settings = get_settings()

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """
    Initialize database: create all tables

    Should be called once when the application starts
    """
    Base.metadata.create_all(bind=engine)
    print(f"[Database] Initialized database at: {settings.DATABASE_URL}")


@contextmanager
def get_db() -> Session:
    """
    Get database session as context manager

    Usage:
        with get_db() as db:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == "123").first()

    Yields:
        SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_dependency():
    """
    FastAPI dependency for database session

    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db_dependency)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
