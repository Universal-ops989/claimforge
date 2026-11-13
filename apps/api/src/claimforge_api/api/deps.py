"""Shared FastAPI dependencies."""

from typing import Annotated, cast

from fastapi import Depends, Request

from claimforge_api.core.settings import Settings


def get_app_settings(request: Request) -> Settings:
    """Settings of the app handling this request (each test app can have its own)."""
    return cast("Settings", request.app.state.settings)


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
