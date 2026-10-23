import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "BloodBridge API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite:///./bloodbridge.db"

    # Auth & JWT
    JWT_SECRET: str = "super-secret-bloodbridge-jwt-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Automation
    AUTOMATION_ENABLED: bool = True

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Vercel/Neon integrations may expose the URL under a different name
        if value.startswith("sqlite"):
            for key in ("POSTGRES_URL", "STORAGE_URL", "NEON_DATABASE_URL"):
                if os.environ.get(key):
                    value = os.environ[key]
                    break

        # SQLAlchemy 2 rejects the legacy "postgres://" scheme
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://"):]

        # Vercel's filesystem is read-only except /tmp (data there is not persistent)
        if value.startswith("sqlite") and os.environ.get("VERCEL"):
            value = "sqlite:////tmp/bloodbridge.db"

        return value


settings = Settings()
