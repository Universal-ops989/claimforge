"""Application settings loaded from environment variables.

Every variable is prefixed with ``CLAIMFORGE_`` (for example ``CLAIMFORGE_DATABASE_URL``).
For local development a ``.env`` file next to ``pyproject.toml`` is also read.
"""

from enum import StrEnum
from functools import lru_cache
from typing import Annotated, Self

from pydantic import Field, PostgresDsn, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


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
    def _check_production_safety(self) -> Self:
        if self.environment is Environment.PRODUCTION:
            if self.debug:
                raise ValueError("CLAIMFORGE_DEBUG must be false in production")
            if "*" in self.cors_origins:
                raise ValueError("CLAIMFORGE_CORS_ORIGINS must not contain '*' in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION


@lru_cache
def get_settings() -> Settings:
    """Process-wide settings, loaded once. Override in tests with ``create_app(settings)``."""
    return Settings()
