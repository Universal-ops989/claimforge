"""Application settings loaded from environment variables.

Every variable is prefixed with ``CLAIMFORGE_`` (for example ``CLAIMFORGE_DATABASE_URL``).
For local development a ``.env`` file next to ``pyproject.toml`` is also read.
"""

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Self

from pydantic import Field, PostgresDsn, SecretStr, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

#: Placeholder for local development only; production refuses to start with it.
DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me"  # noqa: S105


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class StorageBackend(StrEnum):
    LOCAL = "local"
    S3 = "s3"


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class Settings(BaseSettings):
    """Validated runtime configuration. Construct via :func:`get_settings`."""

    model_config = SettingsConfigDict(
        env_prefix="CLAIMFORGE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    log_level: LogLevel = LogLevel.INFO

    database_url: PostgresDsn = Field(
        default=PostgresDsn("postgresql+asyncpg://claimforge:claimforge@localhost:5432/claimforge"),
        description="SQLAlchemy async URL, e.g. postgresql+asyncpg://user:pass@host/db",
    )
    database_pool_size: int = Field(default=10, ge=1, le=100)
    database_echo: bool = False

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:5174"],
        description="Comma-separated list of allowed browser origins.",
    )

    jwt_secret: SecretStr = Field(
        default=SecretStr(DEV_JWT_SECRET),
        description="HMAC key for signing access tokens (at least 32 random characters).",
    )
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=90)

    rate_limit_enabled: bool = Field(
        default=True, description="Throttle authentication endpoints (disable only in load tests)."
    )

    web_app_url: str = Field(
        default="http://localhost:5173",
        pattern=r"^https?://",
        description="Base URL of the web app, used in links sent by email.",
    )

    public_api_url: str = Field(
        default="http://localhost:8000",
        pattern=r"^https?://",
        description="Base URL clients use to reach this API, used in signed storage URLs.",
    )

    storage_backend: StorageBackend = Field(
        default=StorageBackend.LOCAL, description="Where uploaded files are kept."
    )
    storage_local_root: Path = Field(
        default=Path("var/storage"),
        description="Directory for the local backend, relative to the working directory.",
    )
    storage_max_upload_bytes: int = Field(
        default=50 * 1024 * 1024,
        ge=1,
        description="Largest body the local backend accepts on a signed upload URL.",
    )

    s3_endpoint_url: str | None = Field(
        default=None,
        pattern=r"^https?://",
        description="S3-compatible server (SeaweedFS, MinIO, R2). Leave unset for AWS S3.",
    )
    s3_region: str = Field(default="us-east-1", min_length=1)
    s3_bucket: str = Field(
        default="claimforge-media", pattern=r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$"
    )
    s3_access_key: str | None = Field(
        default=None, description="Leave unset to use the standard AWS credential chain."
    )
    s3_secret_key: SecretStr | None = None

    @model_validator(mode="before")
    @classmethod
    def _split_cors_origins(cls, data: object) -> object:
        # Accept "a,b" from the environment as well as a real list.
        if isinstance(data, dict):
            value = data.get("cors_origins")
            if isinstance(value, str):
                data["cors_origins"] = [o.strip() for o in value.split(",") if o.strip()]
        return data

    @model_validator(mode="after")
    def _check_s3_credentials(self) -> Self:
        if (self.s3_access_key is None) != (self.s3_secret_key is None):
            raise ValueError(
                "Set both CLAIMFORGE_S3_ACCESS_KEY and CLAIMFORGE_S3_SECRET_KEY, or neither"
            )
        return self

    @model_validator(mode="after")
    def _check_production_safety(self) -> Self:
        if self.environment is Environment.PRODUCTION:
            if self.debug:
                raise ValueError("CLAIMFORGE_DEBUG must be false in production")
            if "*" in self.cors_origins:
                raise ValueError("CLAIMFORGE_CORS_ORIGINS must not contain '*' in production")
            secret = self.jwt_secret.get_secret_value()
            if secret == DEV_JWT_SECRET or len(secret) < 32:
                raise ValueError(
                    "CLAIMFORGE_JWT_SECRET must be set to at least 32 random characters "
                    "in production"
                )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION


@lru_cache
def get_settings() -> Settings:
    """Process-wide settings, loaded once. Override in tests with ``create_app(settings)``."""
    return Settings()
