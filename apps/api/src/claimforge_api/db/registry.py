"""Imports every model module so ``Base.metadata`` is complete.

Alembic autogenerate and the drift check compare the database against this metadata,
so every new model module must be imported here.
"""

from claimforge_api.audit import models as audit_models
from claimforge_api.auth import models as auth_models
from claimforge_api.db.base import Base
from claimforge_api.invitations import models as invitations_models
from claimforge_api.organizations import models as organizations_models
from claimforge_api.users import models as users_models

metadata = Base.metadata

__all__ = [
    "audit_models",
    "auth_models",
    "invitations_models",
    "metadata",
    "organizations_models",
    "users_models",
]
