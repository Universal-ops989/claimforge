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

- `src/main.tsx`: mounts the router inside the design system's `ThemeProvider`.
- `src/routes.tsx`: every page by address. Claims are addressed by number
  (`/claims/2026-00042`). `/login` sits outside the signed-in layout.
- `src/app/`: what pages share: `RootLayout`, `Page` (the `<h1>` and the tab title,
  "Claims · ClaimForge"), `RouteError` (not found, or something went wrong).
- `src/pages/`: one file per page.
- `src/test/setup.ts`: jest-dom matchers and the browser APIs jsdom lacks.

An address nothing matches, and a loader that throws a 404, both show the not-found page;
any other error shows "Something went wrong" with a retry (and the error itself in dev).
