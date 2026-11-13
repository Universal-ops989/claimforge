"""Imports every model module so ``Base.metadata`` is complete.

Alembic autogenerate and the drift check compare the database against this metadata,
so every new model module must be imported here.
"""

from claimforge_api.db.base import Base

metadata = Base.metadata

__all__ = ["metadata"]
