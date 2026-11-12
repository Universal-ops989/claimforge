# Local development

## Prerequisites

- Node.js 22 (see `.nvmrc`) with Corepack enabled (`corepack enable`)
- Python 3.12
- Docker Desktop (or another Compose v2-compatible runtime)

## Services

```bash
docker compose up -d
```

| Service     | Port                                               | Purpose                                                               |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| Postgres 16 | 5432                                               | Primary database (`claimforge`) and test database (`claimforge_test`) |
| Mailpit     | 1025 (SMTP), [8025](http://localhost:8025) (UI)    | Catches all outgoing email                                            |
| SeaweedFS | 8333 (S3) | S3-compatible photo and document storage (anonymous access locally) |

Credentials are local-only defaults and match `apps/api/.env.example`.

To reset all data:

```bash
docker compose down -v
```
