# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Chinese-language web control panel for [gost](https://gost.run) v3 — a single-page React app that talks to gost's REST API plus two side channels (Prometheus `/metrics`, SSE log feed). UI strings, comments, and commit messages are written in Chinese; match that tone for user-facing copy.

## Commands

- `pnpm dev` — Vite dev server on :5173. Reads `.env.local`; proxies `/proxy-metrics` and `/proxy-logs` to the targets in `VITE_GOST_METRICS_TARGET` / `VITE_GOST_LOGFEED_TARGET`.
- `pnpm build` — `tsc -b && vite build`. Type errors fail the build.
- `pnpm lint` — ESLint (flat config, `eslint.config.js`).
- `pnpm preview` — Serve the built `dist/`.

No test runner is configured — there are no automated tests. Don't add a "run a single test" recipe; there's nothing to run.

## Architecture

### Runtime topology

Browser SPA talks to three endpoints on the gost host:

- **gost API** (`:18080/api`) — REST CRUD over 17 resource types. Basic auth.
- **gost metrics** (`:9000/metrics`) — Prometheus text format, polled every 3s on `/metrics` page.
- **gost-logfeed** (`:19090`) — a zero-dependency Node sidecar (`tools/gost-logfeed.mjs`) that `tail -F`s the gost log file and re-emits each line as SSE. Token-gated via `?t=<token>`.

In dev, Vite proxies `/proxy-metrics` and `/proxy-logs` because gost's metrics/logfeed ports don't send CORS headers. In prod, you put Caddy/nginx in front and reverse-proxy the same paths.

### Host profiles (multi-host)

`src/lib/profiles.ts` is the source of truth for which gost host the app is currently talking to. Profiles live in `localStorage` (`gost-panel:profiles`, `gost-panel:active`) and are exposed via a `useSyncExternalStore` hook. On boot, `bootstrapFromEnv()` seeds a profile from `VITE_GOST_*` env vars if the user has none — this is the legacy single-host path.

`src/lib/api.ts` is a **single shared axios instance** whose request interceptor pulls `getActiveProfile()` per-request and sets `baseURL` + basic auth dynamically. **Do not** create new axios instances or hardcode base URLs — profile switching depends on this indirection. Metrics and logs pages read `metricsUrl` / `logfeedUrl` from the same active profile.

If no profile exists and `App.tsx#Shell` sees `profiles.length === 0`, all routes redirect to `/welcome` (the setup page).

### Resource model — the 17 types

`src/lib/resources.ts` enumerates the 17 gost resource keys (services, chains, hops, authers, admissions, bypasses, resolvers, hosts, ingresses, routers, observers, recorders, sds, limiters, climiters, rlimiters) and groups them. Almost everything resource-related is parameterized by `ResourceKey`:

- `src/lib/queries.ts` — generic `useResourceList(key)` / `useResource(key, name)` / `useCreate|Update|DeleteResource(key)` TanStack Query hooks, all calling `/config/${key}` and `/config/${key}/${name}`.
- `src/pages/ResourceListPage.tsx` — one page handles all 17 list views, reading `:key` from the route `/r/:key`.
- `src/components/forms/registry.tsx` — **structured forms exist for only 8 of the 17 types** (services, authers, bypasses, admissions, hosts, resolvers, hops, chains). `hasForm(key)` decides whether the edit dialog shows a form/JSON tab pair or JSON-only. When adding a new form, register it here.

When a new gost resource type appears, add it to `RESOURCES` in `resources.ts` and (optionally) a form in `components/forms/`. Everything else picks it up automatically.

### Type info & UX scaffolding

`src/lib/gostTypes.ts`, `templates.ts`, `help.ts`, `cookbook.ts`, `clientRecipes.ts` — static metadata that drives the "newbie-friendly" surface area: handler/listener/connector/dialer type lists with one-line descriptions, JSON templates seeded into new resources, the help banner on each resource page, and the cookbook/recipe presets. Editing these does **not** touch any API code — they're pure data.

Cross-resource references (e.g. a service picking which `chain` to use) use `ResourceRefField` which queries `useExistingNames(otherKey)` and falls back to a free-text input + "去配置 ↗" link when the target list is empty.

### Path alias

`@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`). Use it everywhere instead of relative paths past one level.

### Styling

Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config.js`; the design tokens live as CSS custom properties in `src/index.css`. The signal color is a single mint-cyan `oklch(0.6 0.18 175)`. Fonts: Hanken Grotesk + JetBrains Mono. When adding UI, reuse the primitives in `src/components/ui/` (Card, Button, Dialog, Tabs, Input, Form, HelpBanner, TypeHint, ResourceRefField, PasswordField, EditorJson) rather than re-rolling them.

## Conventions worth knowing

- React 19, TypeScript ~6, strict. React Router v7 (BrowserRouter, declarative `<Routes>`).
- TanStack Query is the only data layer — no redux/zustand. Profile state is the one exception (custom external store, because it's pre-Query bootstrap).
- gost returns response envelopes inconsistently — some endpoints wrap as `{data: ...}`, others don't. See `useResource` in `queries.ts` for the handling pattern; replicate it if you add new fetchers.
- No i18n abstraction — all user-facing strings are Chinese literals. `src/lib/i18n.ts` exists but is minimal.
- The logfeed sidecar (`tools/gost-logfeed.mjs`) is deliberately zero-dependency and meant to be copied to `/usr/local/bin/` on the gost host. Keep it that way; don't pull npm deps into it.
