from typing import Any

import pytest
from pydantic import ValidationError

from claimforge_api.core.settings import Environment, LogLevel, Settings


def make(**overrides: Any) -> Settings:
    """Settings that ignore any developer .env file."""
    return Settings(_env_file=None, **overrides)


def test_defaults_are_safe_for_local_development() -> None:
    settings = make()

    assert settings.environment is Environment.DEVELOPMENT
    assert settings.debug is False
    assert settings.log_level is LogLevel.INFO
    assert settings.database_url.scheme == "postgresql+asyncpg"
    assert not settings.is_production


def test_reads_prefixed_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAIMFORGE_ENVIRONMENT", "test")
    monkeypatch.setenv("CLAIMFORGE_LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("CLAIMFORGE_DATABASE_URL", "postgresql+asyncpg://u:p@db:5432/cf")
    monkeypatch.setenv(
        "CLAIMFORGE_CORS_ORIGINS", "https://app.example.com, https://portal.example.com"
    )

    settings = make()

    assert settings.environment is Environment.TEST
    assert settings.log_level is LogLevel.DEBUG
    assert settings.database_url.hosts()[0]["host"] == "db"
    assert settings.cors_origins == ["https://app.example.com", "https://portal.example.com"]


def test_invalid_values_name_the_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAIMFORGE_DATABASE_URL", "not-a-url")

    with pytest.raises(ValidationError, match="database_url"):
        make()


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"debug": True}, "CLAIMFORGE_DEBUG"),
        ({"cors_origins": ["*"]}, "CLAIMFORGE_CORS_ORIGINS"),
    ],
)
def test_production_rejects_unsafe_configuration(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        make(environment="production", **overrides)


def test_settings_are_immutable() -> None:
    settings = make()

    with pytest.raises(ValidationError):
        settings.debug = True  # type: ignore[misc]
