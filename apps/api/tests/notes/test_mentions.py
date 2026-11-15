"""Mention tokens: finding them in a body and rendering them as names."""

from uuid import UUID

from claimforge_api.notes import mentions

AVERY = UUID("0192f3a4-5b6c-7d8e-9f01-23456789abcd")
BLAKE = UUID("0192f3a4-5b6c-7d8e-9f01-000000000002")


def test_tokens_round_trip() -> None:
    assert mentions.mentioned_ids(f"Hi {mentions.token(AVERY)}") == [AVERY]


def test_each_member_once_in_order_of_first_mention() -> None:
    body = f"<@{BLAKE}> and <@{AVERY}>, then <@{str(BLAKE).upper()}> again"

    assert mentions.mentioned_ids(body) == [BLAKE, AVERY]


def test_anything_that_is_not_a_token_is_just_text() -> None:
    for body in ["@Avery", "<@avery>", f"<{AVERY}>", f"<@{AVERY}", f"<@ {AVERY}>", "<@>"]:
        assert mentions.mentioned_ids(body) == [], body
        assert mentions.render(body, {AVERY: "Avery"}) == body


def test_render_fills_in_names() -> None:
    body = f"<@{AVERY}>: ask <@{BLAKE}> about the dehu."

    assert mentions.render(body, {AVERY: "Avery Adjuster"}) == (
        "@Avery Adjuster: ask @unknown member about the dehu."
    )
