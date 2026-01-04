"""
Configuration module for MCP Quendoo Chatbot
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./chatbot.db"

    # Encryption (Fernet key for API key encryption)
    ENCRYPTION_KEY: str

    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # CORS (parse comma-separated string)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://quendoo-ai-dashboard.web.app"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # Connection settings
    MAX_CONNECTIONS_PER_TENANT: int = 10
    CONNECTION_TIMEOUT_MINUTES: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get global settings instance"""
    return settings
