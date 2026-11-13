"""Export the OpenAPI contract.

    python -m claimforge_api.openapi            # write apps/api/openapi.json
    python -m claimforge_api.openapi --check    # fail if the committed file is stale

The committed schema is the contract the TypeScript client is generated from, so CI checks
that it always matches the code.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from claimforge_api.core.settings import Settings
from claimforge_api.main import create_app

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "openapi.json"


def build_schema() -> dict[str, Any]:
    # Settings without any .env; building the schema never touches the database.
    app = create_app(Settings(_env_file=None))
    return app.openapi()


def render(schema: dict[str, Any]) -> str:
    """Deterministic text so diffs only show real contract changes."""
    return json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=DEFAULT_PATH)
    parser.add_argument("--check", action="store_true", help="verify instead of writing")
    args = parser.parse_args(argv)

    rendered = render(build_schema())
    if args.check:
        current = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
        if current != rendered:
            print(
                f"{args.output} is out of date. Run `just api-openapi` and commit the result.",
                file=sys.stderr,
            )
            return 1
        return 0

    args.output.write_text(rendered, encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
