import httpx2
import pytest


async def create(client: httpx2.AsyncClient, **body: object) -> dict[str, object]:
    response = await client.post("/v1/organizations", json=body)
    assert response.status_code == 201, response.text
    payload: dict[str, object] = response.json()
    return payload


async def test_create_and_get(client: httpx2.AsyncClient) -> None:
    created = await create(client, name="Rivera Restoration", timezone="America/Chicago")

    response = await client.get(f"/v1/organizations/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created
    assert created["slug"] == "rivera-restoration"
    assert created["timezone"] == "America/Chicago"


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"name": ""}, "name"),
        ({"name": "Acme", "timezone": "Mars/Olympus"}, "timezone"),
        ({"name": "Acme", "slug": "Not Valid"}, "slug"),
        ({"name": "Acme", "extra": 1}, "extra"),
    ],
)
async def test_create_validates_input(
    client: httpx2.AsyncClient, body: dict[str, object], field: str
) -> None:
    response = await client.post("/v1/organizations", json=body)

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"][-1] == field


async def test_explicit_slug_conflict_is_409(client: httpx2.AsyncClient) -> None:
    await create(client, name="Dry Co", slug="dry-co")

    response = await client.post("/v1/organizations", json={"name": "Other", "slug": "dry-co"})

    assert response.status_code == 409
    assert response.json()["code"] == "slug_taken"
    assert response.json()["slug"] == "dry-co"


async def test_update_changes_only_given_fields(client: httpx2.AsyncClient) -> None:
    created = await create(client, name="Old Name")

    response = await client.patch(
        f"/v1/organizations/{created['id']}", json={"timezone": "Europe/London"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Old Name"
    assert response.json()["timezone"] == "Europe/London"
    assert response.json()["updated_at"] >= str(created["updated_at"])


async def test_slug_cannot_be_patched(client: httpx2.AsyncClient) -> None:
    created = await create(client, name="Stable")

    response = await client.patch(f"/v1/organizations/{created['id']}", json={"slug": "new"})

    assert response.status_code == 422


async def test_delete_hides_the_organization(client: httpx2.AsyncClient) -> None:
    created = await create(client, name="Gone Soon")

    assert (await client.delete(f"/v1/organizations/{created['id']}")).status_code == 204
    missing = await client.get(f"/v1/organizations/{created['id']}")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


async def test_list_is_paginated_newest_first(client: httpx2.AsyncClient) -> None:
    names = [f"Org {i}" for i in range(5)]
    for name in names:
        await create(client, name=name)

    first = (await client.get("/v1/organizations", params={"limit": 3})).json()
    second = (
        await client.get("/v1/organizations", params={"limit": 3, "cursor": first["next_cursor"]})
    ).json()

    listed = [o["name"] for o in first["items"] + second["items"]]
    assert listed[:5] == list(reversed(names))
    assert first["has_more"] is True


async def test_unknown_id_is_404_and_bad_id_is_422(client: httpx2.AsyncClient) -> None:
    unknown = await client.get("/v1/organizations/01937c4e-0000-7000-8000-000000000000")
    malformed = await client.get("/v1/organizations/not-a-uuid")

    assert unknown.status_code == 404
    assert malformed.status_code == 422
