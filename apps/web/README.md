# @claimforge/web

The ClaimForge web app: claims, field documentation, estimates and reports for adjusters,
technicians and office staff. React 19 and Vite, built on the design system
(`@claimforge/ui`) and the typed API client (`@claimforge/api-client`).

## Running it

```sh
pnpm install
pnpm --filter @claimforge/ui build   # the app imports the built design system
pnpm --filter @claimforge/web dev    # http://localhost:5173
```

| Script                      | What it does                                 |
| --------------------------- | -------------------------------------------- |
| `dev`                       | Vite dev server on port 5173                 |
| `build`                     | Production bundle in `dist/`                 |
| `preview`                   | Serve `dist/` on port 4173                   |
| `lint`, `typecheck`, `test` | What CI runs (via turbo, from the repo root) |

## Layout

- `src/main.tsx`: mounts the app inside the design system's `ThemeProvider`.
- `src/app.tsx`: the root component.
- `src/test/setup.ts`: jest-dom matchers and the browser APIs jsdom lacks.
