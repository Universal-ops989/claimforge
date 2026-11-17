"""Publish the status workflows in the OpenAPI contract.

Responses say where one claim or estimate can go next (``next_statuses``); these
extensions say it for every status at once, from the same tables the API enforces, so a
client that needs the whole workflow (a diagram, a mock backend) reads it instead of
keeping a copy that drifts:

- ``x-transitions``: status → the statuses it can change to, in the order
  ``next_statuses`` lists them.
- ``x-reason-required`` (claims): status → the targets a change needs a reason for.
"""

from typing import Any

from claimforge_api.claims import workflow as claim_workflow
from claimforge_api.claims.models import ClaimStatus
from claimforge_api.estimates.models import EstimateStatus
from claimforge_api.estimates.service import TRANSITIONS as ESTIMATE_TRANSITIONS


def claim_transitions() -> dict[str, list[str]]:
    return {
        status.value: [target.value for target in claim_workflow.next_statuses(status)]
        for status in ClaimStatus
    }


def claim_reasons_required() -> dict[str, list[str]]:
    return {
        status.value: [
            target.value
            for target in claim_workflow.next_statuses(status)
            if claim_workflow.needs_reason(status, target)
        ]
        for status in ClaimStatus
    }


def estimate_transitions() -> dict[str, list[str]]:
    # The order next_statuses uses: the table's.
    return {
        status.value: [target.value for target in ESTIMATE_TRANSITIONS[status]]
        for status in EstimateStatus
    }


def document_workflows(schema: dict[str, Any]) -> dict[str, Any]:
    """Add the workflow extensions to the status schemas of ``schema``, in place."""
    schemas = schema["components"]["schemas"]
    schemas["ClaimStatus"]["x-transitions"] = claim_transitions()
    schemas["ClaimStatus"]["x-reason-required"] = claim_reasons_required()
    schemas["EstimateStatus"]["x-transitions"] = estimate_transitions()
    return schema
