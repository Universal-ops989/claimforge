# ClaimForge

**ClaimForge** is a platform for property-damage claims and restoration. Adjusters,
restoration contractors and policyholders use it to document a loss, track mitigation
work in the field, and produce estimates and reports. Everyone works from the same
record.

> Status: early development. See [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

## Features (planned)

- **Claims workflow**: intake, assignments, a status state machine and an activity timeline
- **Field documentation**: rooms, damage items, photos, moisture and atmospheric readings
- **Drying management**: equipment placement, drying goals and dry-standard alerts
- **Estimates and reports**: price lists, line items, and PDF photo and drying reports
- **Policyholder portal**: claim tracking, uploads and messaging
- **Design system**: reusable, accessible React components documented in Storybook

## Tech stack

| Layer         | Technology                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| API           | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2                    |
| Database      | PostgreSQL 16                                                                       |
| Frontend      | React 19, TypeScript, Vite 8, TanStack Query, React Router, React Hook Form + Zod   |
| Design system | `@claimforge/ui` (CSS Modules + Radix primitives) + Storybook 10                    |
| Tooling       | pnpm workspaces, Turborepo, just, pip-tools, ruff, mypy, Vitest, Pytest, Playwright |
| CI            | GitHub Actions                                                                      |

## Repository layout

```
apps/
  api/          FastAPI backend
  web/          Main web app for adjusters and contractors
  portal/       Policyholder portal
packages/
  ui/           Design system and Storybook
  api-client/   Typed API client and TanStack Query hooks
  tsconfig/     Shared TypeScript configs
  eslint-config/ Shared lint rules
docs/           Roadmap, ADRs and guides
```

## License

[MIT](LICENSE)
