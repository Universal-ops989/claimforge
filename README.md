# ClaimForge

[![Web](https://github.com/Universal-ops989/claimforge/actions/workflows/web.yml/badge.svg)](https://github.com/Universal-ops989/claimforge/actions/workflows/web.yml)
[![API](https://github.com/Universal-ops989/claimforge/actions/workflows/api.yml/badge.svg)](https://github.com/Universal-ops989/claimforge/actions/workflows/api.yml)
[![Storybook](https://img.shields.io/badge/Storybook-live-ff4785?logo=storybook&logoColor=white)](https://universal-ops989.github.io/claimforge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**ClaimForge** is a platform for property-damage claims and restoration. Adjusters,
restoration contractors and policyholders use it to document a loss, track mitigation
work in the field, and produce estimates and reports. Everyone works from the same
record.

> Status: early development. See [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

**[Explore the live component library →](https://universal-ops989.github.io/claimforge/)**
Every component in `@claimforge/ui`, with light and dark themes, accessibility checks
and interaction tests.

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
