"""Global search over HTTP: words across a claim's records, ranking, scope and access."""

from typing import Any
from uuid import UUID

import httpx2
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import ClientFor

from claimforge_api.claims.models import Claim
from claimforge_api.contacts.models import Contact
from claimforge_api.users.models import Role


async def send(client: httpx2.AsyncClient, method: str, url: str, **body: Any) -> dict[str, Any]:
    response = await client.request(method, url, json=body or None)
    assert response.status_code < 300, response.text
    payload: dict[str, Any] = response.json() if response.content else {}
    return payload


@pytest.fixture
def base(organization_id: UUID) -> str:
    return f"/v1/organizations/{organization_id}"


class World:
    """Two claims: Dana's in Austin, and a Dallas one whose note mentions Dana."""

    def __init__(self, data: dict[str, dict[str, Any]]) -> None:
        self.austin, self.dallas = data["austin"], data["dallas"]
        self.dana, self.morgan = data["dana"], data["morgan"]


@pytest.fixture
async def world(auth_client: httpx2.AsyncClient, base: str) -> World:
    dana = await send(
        auth_client,
        "POST",
        f"{base}/contacts",
        full_name="Dana Whitfield",
        email="dana@example.com",
    )
    morgan = await send(auth_client, "POST", f"{base}/contacts", full_name="Morgan Lee")
    austin = await send(
        auth_client,
        "POST",
        f"{base}/claims",
        loss_type="water",
        carrier_claim_number="LSM-88213",
        property={
            "address": {
                "line1": "123 Bluebonnet Lane",
                "city": "Austin",
                "region": "TX",
                "postal_code": "78701",
            }
        },
        contacts=[{"contact_id": dana["id"], "role": "insured", "is_primary": True}],
    )
    dallas = await send(
        auth_client,
        "POST",
        f"{base}/claims",
        loss_type="flood",
        description="Basement flooded after the storm",
        property={
            "address": {
                "line1": "9 Oak St",
                "city": "Dallas",
                "region": "TX",
                "postal_code": "75201",
            }
        },
        contacts=[{"contact_id": morgan["id"], "role": "tenant"}],
    )
    await send(auth_client, "POST", f"{base}/claims/{dallas['id']}/notes", body="Call Dana first")
    return World({"austin": austin, "dallas": dallas, "dana": dana, "morgan": morgan})


async def search(client: httpx2.AsyncClient, base: str, q: str, **params: Any) -> dict[str, Any]:
    response = await client.get(f"{base}/search", params={"q": q, **params})
    assert response.status_code == 200, response.text
    payload: dict[str, Any] = response.json()
    return payload


def claim_ids(results: dict[str, Any]) -> list[str]:
    return [hit["claim"]["id"] for hit in results["claims"]]


def contact_names(results: dict[str, Any]) -> list[str]:
    return [hit["contact"]["full_name"] for hit in results["contacts"]]


async def test_words_can_match_different_records_of_a_claim(
    auth_client: httpx2.AsyncClient, base: str, world: World
) -> None:
    results = await search(auth_client, base, "whitfield austin")

    [hit] = results["claims"]
    assert hit["claim"]["id"] == world.austin["id"]
    assert hit["matched_in"] == ["property", "contact"]
    assert hit["claim"]["primary_contact"]["contact"]["full_name"] == "Dana Whitfield"
    # No single contact is in Austin.
    assert results["contacts"] == []


async def test_a_name_finds_the_person_and_their_claims(
    auth_client: httpx2.AsyncClient, base: str, world: World
) -> None:
    results = await search(auth_client, base, "dana")

    # Linked as the insured ranks above being mentioned in a note.
    assert claim_ids(results) == [world.austin["id"], world.dallas["id"]]
    assert [h["matched_in"] for h in results["claims"]] == [["contact"], ["note"]]
    assert contact_names(results) == ["Dana Whitfield"]


async def test_typing_as_you_go(auth_client: httpx2.AsyncClient, base: str, world: World) -> None:
    assert claim_ids(await search(auth_client, base, "blueb")) == [world.austin["id"]]
    assert claim_ids(await search(auth_client, base, "flooding")) == [world.dallas["id"]]
    assert contact_names(await search(auth_client, base, "morg")) == ["Morgan Lee"]
    assert contact_names(await search(auth_client, base, "example.com")) == ["Dana Whitfield"]


async def test_claim_numbers_come_first(
    auth_client: httpx2.AsyncClient, base: str, world: World
) -> None:
    # Both claims share the year prefix; the exact number wins.
    exact = await search(auth_client, base, world.dallas["number"])
    assert claim_ids(exact)[0] == world.dallas["id"]
    assert claim_ids(await search(auth_client, base, "lsm-88213")) == [world.austin["id"]]


async def test_deleted_and_foreign_records_stay_hidden(
    auth_client: httpx2.AsyncClient,
    client_for: ClientFor,
    db_session: AsyncSession,
    base: str,
    world: World,
) -> None:
    dana = await db_session.get(Contact, UUID(world.dana["id"]))
    dallas = await db_session.get(Claim, UUID(world.dallas["id"]))
    assert dana is not None
    assert dallas is not None
    dana.soft_delete()
    dallas.soft_delete()
    await db_session.commit()

    results = await search(auth_client, base, "dana")
    assert (results["claims"], results["contacts"]) == ([], [])

    outsider = await client_for(None)
    theirs = await send(outsider, "POST", "/v1/organizations", name="Theirs")
    elsewhere = await search(outsider, f"/v1/organizations/{theirs['id']}", "austin")
    assert (elsewhere["claims"], elsewhere["contacts"]) == ([], [])
    assert (await outsider.get(f"{base}/search", params={"q": "austin"})).status_code == 404


async def test_access_and_input(
    auth_client: httpx2.AsyncClient, client_for: ClientFor, base: str, world: World
) -> None:
    viewer = await client_for(Role.VIEWER)

    assert claim_ids(await search(viewer, base, "austin")) == [world.austin["id"]]
    assert await search(auth_client, base, "!!") == {"claims": [], "contacts": []}
    assert len((await search(auth_client, base, "tx", limit=1))["claims"]) == 1
    invalid: list[dict[str, str | int]] = [
        {},
        {"q": ""},
        {"q": "x" * 201},
        {"q": "tx", "limit": 26},
    ]
    for params in invalid:
        assert (await auth_client.get(f"{base}/search", params=params)).status_code == 422
