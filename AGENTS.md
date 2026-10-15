# AGENTS.md

## Build & Verify Commands

### Frontend (React + TypeScript + Vite)
- Type check: `npx tsc --noEmit` (in `apps/desktop/`)
- Full build: `pnpm build` (runs tsc + vite build)
- Dev server: `pnpm dev:desktop` (or `pnpm dev:vite` in `apps/desktop/`)

### Backend (Rust + Tauri)
- Type check: `cargo check` (in `apps/desktop/src-tauri/`)
- Lint: `cargo clippy` (in `apps/desktop/src-tauri/`)
- Full desktop build: `pnpm --filter @apps/desktop tauri build`

### Monorepo (pnpm + Turborepo)
- All workspaces: `pnpm lint`, `pnpm check-types`, `pnpm build`
- Brand sync: `pnpm sync-brand` (propagates brand.json into every consumer)

## Architecture

Tauri 2 desktop app in a pnpm/Turborepo monorepo. Backend is Rust (in-process
IPC via `invoke()`, not HTTP). Frontend is React 19 + TypeScript + Tailwind v4.

### Key directories
- `apps/desktop/src/` — frontend (React)
- `apps/desktop/src-tauri/src/` — backend (Rust)
- `apps/desktop/src/lib/api.ts` — all `invoke()` wrappers + event listeners
- `apps/desktop/src/context/app-context.tsx` — global state provider (settings loading, event subscriptions)
- `apps/desktop/src-tauri/src/commands.rs` — all IPC command definitions
- `apps/desktop/src-tauri/src/db.rs` — SQLite data access layer
- `apps/desktop/src-tauri/src/migrations/sql/` — SQL migrations (append-only)
- `packages/ui` — shared shadcn-style component kit
- `brand.json` — single source of truth for branding + version (never edit consumers by hand)

### Data flow
Frontend calls `invoke("command_name", args)` → Rust Tauri command → SQLite.
Backend emits events (`update://available`) → frontend `listen()` in the context.

### Types
Frontend types in `src/types.ts` mirror Rust serde output (snake_case for
backend types). Map them to camelCase view types in the context.

### Branding rule
Any PR touching brand values must change `brand.json` only, then run
`pnpm sync-brand` and commit the result. CI enforces it with
`pnpm sync-brand:check`. Releases (`pnpm release:tag`) re-run the sync
automatically before tagging.
