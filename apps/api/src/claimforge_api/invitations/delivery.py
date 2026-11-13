"""How invitation links reach people.

The service hands links to an ``InvitationSender``; it never returns tokens to the inviter
(who could otherwise accept on the invitee's behalf). Email delivery replaces the logging
sender when notifications land; tests use a recording sender.
"""

import logging
from dataclasses import dataclass
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InvitationMessage:
    email: str
    organization_name: str
    inviter_name: str
    role: str
    accept_url: str


class InvitationSender(Protocol):
    async def send(self, message: InvitationMessage) -> None: ...


class LoggingInvitationSender:
    """Development stand-in for email: writes the accept link to the log."""

    async def send(self, message: InvitationMessage) -> None:
        logger.info(
            "Invitation for %s to join %s as %s: %s",
            message.email,
            message.organization_name,
            message.role,
            message.accept_url,
        )
