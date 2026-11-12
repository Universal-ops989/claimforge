# Contributing to ClaimForge

## Workflow

1. Branch from `main` using a prefix that matches the change:
   `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `ci/`, `refactor/`.
2. Keep pull requests small and focused, one roadmap item or less. Small PRs are
   reviewed faster and are easier to revert.
3. Every commit on `main` must pass CI.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add claim status transitions
fix(ui): keep focus inside Dialog when tabbing backwards
```

Common scopes are `api`, `ui`, `web`, `portal`, `api-client`, `eslint-config`
and `tsconfig`.

## Code standards

### TypeScript

- Strict mode everywhere. Avoid `any`; prefer `unknown` plus narrowing.
- Validate API boundaries with Zod.
- Server state lives in TanStack Query. Keep component state local.
- New UI goes into `@claimforge/ui` with a Storybook story when it is reusable.
- Components must be keyboard-accessible and pass the Storybook a11y checks.

### Python

- Fully typed; `mypy --strict` must pass.
- Business logic lives in services, not in route handlers.
- Write tests with pytest functions and fixtures, not `unittest` classes.

## Running checks locally

```bash
just check        # everything CI runs
just api-test -k claims   # a subset of API tests
just              # list all recipes
```

See [docs/local-development.md](docs/local-development.md) for environment setup.
