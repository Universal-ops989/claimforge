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
- `src/api/client.ts`: the app's API client (validation `throw` in development, `report`
  in production; tabs take turns refreshing the session).
- `src/app/providers.tsx`: theme, query cache and API client for every page.
- `src/mocks/browser.ts`: the mock API in the browser, for `VITE_API_MOCK=true` only.
- `src/test/render.tsx`: `renderApp(path, { signedInAs })` renders routes with the real
  providers against the mock backend (`msw/node`), reset after every test.
- `src/test/setup.ts`: jest-dom matchers, the mock server, and the browser APIs jsdom lacks.

## Sessions

The session's tokens live in `localStorage` (`claimforge.session`), so reloads and new tabs
stay signed in; `src/auth/session-store.ts` reads corrupt data as signed out and falls back
to memory when the browser refuses storage. Tabs follow each other through `storage`
events: the API revokes a refresh token presented twice, so a tab must refresh with the
token another tab rotated, never the old one. Every page in the signed-in layout sends a
signed-out visitor to `/login?next=…`; `/login` sends someone signed in on.

Signing out (`useSignOut()`) revokes the session at the API, empties the query cache and
starts over at `/login`. A session that ends on its own (a refused refresh, another tab,
cleared site data) sends the user to sign in with `next` set and says so; the store's
`endedBy()` tells the two apart.

An address nothing matches, and a loader that throws a 404, both show the not-found page;
any other error shows "Something went wrong" with a retry (and the error itself in dev).
