from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI

from claimforge_api.invitations.delivery import InvitationMessage


class RecordingSender:
    """Captures invitation messages instead of emailing them."""

    def __init__(self) -> None:
        self.messages: list[InvitationMessage] = []

    async def send(self, message: InvitationMessage) -> None:
        self.messages.append(message)

    @property
    def last_token(self) -> str:
        return parse_qs(urlparse(self.messages[-1].accept_url).query)["token"][0]


@pytest.fixture
def sender(app: FastAPI) -> RecordingSender:
    recording = RecordingSender()
    app.state.invitation_sender = recording
    return recording
