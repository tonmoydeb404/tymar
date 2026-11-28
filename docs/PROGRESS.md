# Tymar — Work Progress

> **Historical.** This log was written during the Appwrite era. The backend is
> now Supabase (see `supabase/migrations`) and the timer is local-first
> (SQLite is the source of truth; the sync engine mirrors it to the cloud).
> References to Appwrite below describe the old design.

Last updated: 2026-09-25. Covers everything from the empty scaffold through
Phase 6 (cloud-backed cross-device timer).

## 1. Status snapshot

| Area | Status |
|---|---|
| Phase 0 — Appwrite backend | Done, provisioned + verified live |
| Phase 1 — Foundation + auth | Done (web proven; desktop in final testing) |
| Phase 2 — Projects & tasks | Done, cross-checked web ↔ desktop |
| Phase 3 — Core time tracking | Superseded by Phase 6 |
| Phase 4 — Tray experience | Superseded by Phase 6 (IPC-driven tray) |
| UX rounds (sheets, DataState, 420px, Today redesign) | Done |
| OAuth hardening (deep link → web bridge) | Done, in final user testing |
| Phase 5 — Dashboard analytics/history/editing | Done, needs live-data check |
| Phase 6 — Realtime cross-device timer | Done (code), needs live 2-device check |

Working tree holds the Phase 6 implementation; every prior step is committed
on `main`.

## 2. As-built architecture

```
Webview (React + Appwrite Web SDK)      Rust process (always alive)
┌──────────────────────────────┐        ┌─────────────────────────┐
│ Auth (session, deep-link)    │        │ Tray mirror (receives   │
│ Timer: open-entry reads +    │ invoke │  TrayState pushes)      │
│   realtime subscription      │◄──────►│ Legacy drain commands   │
│ Projects/tasks/time-entries  │ events │  (timer-state.json)     │
│ UI + tray pushes             │        │ Settings KV (SQLite)    │
└──────────────┬───────────────┘        └─────────────────────────┘
               │ Appwrite SDK (no Appwrite code in Rust)
               ▼
        Appwrite Cloud (sgp) — sole source of truth
```

Rules that survived: elapsed always derives from stored timestamps; duration
is never stored (derived); Appwrite IDs are server-generated; breaks attach
to the active task; document/row security enforces per-user isolation (no
server API key ships in any client). Phase 6 rules: **the cloud is the only
source of truth for the running timer** — the open entry (`endedAt` null) is
the timer; one boot-time fetch + realtime keep every device in sync; writes
are direct API calls; offline = blocked (no local fallback, no orphans);
Rust owns no timer state, only renders pushed tray state.

## 3. Phase log

### Phase 0 — Backend provisioning (committed in `ee9d346`, revised later)
- `scripts/provision-appwrite.mjs` (`pnpm provision:appwrite`, dotenv-loaded,
  idempotent): creates the `timer` database + 4 tables with columns, indexes,
  `permissions: [create("users")]`, `rowSecurity: true`.
- Backend (verified live): project `6ab126930005ec0ad986` on
  `sgp.cloud.appwrite.io` → tables `profiles` (5 cols, 1 idx), `projects`
  (5, 2), `tasks` (9, 2), `time_entries` (5, 2), all row-secured.
- Scope saga (worth knowing): this server (v2.2.0) split the API. Schema
  management moved to `/tablesdb/*` (tables/columns/rows, current scopes);
  the old `/databases/*/collections` endpoints demand deprecated scopes.
  The script uses **only the current TablesDB API**; the provisioning key
  needs just the 27 Database scopes. Runtime document calls use whatever
  the current SDK uses (`/collections/…/documents` in web SDK v27 — still
  current there; desktop Rust uses `/tablesdb/…/rows`).

### Phase 1 — Foundation + auth (`ee9d346`, then hardened)
- `@packages/domain`: Appwrite IDs, domain types, timezone-safe time utils
  (midnight-splitting verified incl. DST transitions).
- Web: `/login`, `/auth/callback`, `/dashboard/*` (overview/projects/tasks/
  time/settings placeholders→real pages in Phase 2), `src/proxy.ts` route
  gate (Next 16 convention) on a first-party `timer_auth` marker cookie
  (`/api/auth/session`), because the Appwrite session is invisible to
  Next.js (third-party cookie / SDK localStorage fallback — confirmed from
  SDK source). Marketing pages moved to the `(site)` route group untouched.
- Desktop auth (final shape after §5): Google OAuth in the **system
  browser** → Appwrite → web bridge `/auth/desktop` → `tymar://auth`
  deep link → frontend `account.createSession`. Session + all Appwrite I/O
  live in the webview SDK. Rust holds no credentials.

### Phase 2 — Projects & tasks (`1afb29d`)
- Web: profile auto-create (device timezone) + `Personal` seed on first
  login; projects CRUD (rename/archive/soft-delete, delete blocked with
  active tasks); project detail; tasks CRUD with search + project/status
  filters, complete/reopen, priorities, due dates.
- Desktop: today's active tasks + search + quick-add (project picker).
- Proven with a live row-lifecycle smoke test (create→query→update→delete).

### UX rounds (`1a5a810`, `20c8728`)
- `@packages/ui`: `DataState` (skeleton/error/empty via props) and
  `ResponsiveSheet` (Sheet on desktop, Drawer on mobile/narrow).
- Web forms → sheets; all lists → `DataState`; dashboard navbar theme
  toggle.
- Desktop window fixed at **420×560**; sidebar replaced by a tab shell
  (header with sync status + bottom tabs); Today screen rebuilt from the
  approved tracker mockup (project strip, timer card, summaries, queue,
  sync footer). Deliberately omitted from the mockup: fake window
  controls, screenshot/activity pill (PRD non-goal), 10-min block bar
  (needs a running timer), manual entry (not MVP).

### Phase 3 — Core time tracking (`02bf001`)
- Rust `timer.rs`: start → working ↔ break → stop, one-action switch;
  `state.json` persistence (atomic write); 10 unit tests (restart
  recovery, break cycles, switch, midnight stays one absolute segment —
  splitting is analytics-side).
- Closed segments queue in `pending` (FIFO, local ids); frontend uploads
  via SDK on every view change and acks by id; `Sync pending (n)` footer.
- Async lock serializes rapid taps; `tymar://changed` events drive UI.
- Desktop UI: toggle start/stop, Break↔Resume, switch picker (+quick-add
  into the running project), focus task shared Today↔Tasks, ticking
  timestamp-derived display.

### Phase 4 — Tray (`1d2c659`)
- Dynamic menu: `● task — elapsed`, Break/Resume, Stop, Switch Task,
  Open, Quit (+ idle variant); tooltip mirrors state; rebuild on every
  transition + 30s tick while running. Tray actions reuse the timer
  commands; Switch opens the window and asks Today for the picker.
- Needs an OS-level check (menu rendering/tick) — not verifiable headless.

### Phase 6 — Realtime cross-device timer (uncommitted)

Bug that drove it: the live timer lived in `timer-state.json` (per-device),
so a timer started on one device was invisible on another; the open-entry
docs the old version created were write-only (never queried back).

- Cloud layer (`lib/db.ts`): `getActiveTimeEntry` (`endedAt` IS NULL, limit
  1) + `closeTimeEntry`. Start = create open doc; stop/break/resume/switch =
  close + create — all direct SDK calls; failures leave no local trace
  (offline start is blocked by design — no orphans, no duplicate timers).
- Realtime (`lib/realtime.ts`): one `client.subscribe` on
  `tablesdb.timer.tables.time_entries.rows` filtered by `userId`; events
  drive the running state on every device (create with null `endedAt` →
  running; close/delete of the tracked id → idle). `timer-context.tsx` is
  rewritten to derive everything from this; elapsed is anchored at fetch
  time (`elapsedMsBase + now - fetchedAt`) so device clock skew can't jump
  the display. Safety refetch on window focus + 60s tick.
- Tray (`tray.rs`): Rust no longer owns timer state. New `set_tray_state`
  command receives `TrayState {running, on_break, title, elapsed_ms}` from
  the frontend (30s cadence for the readout); Break/Resume/Stop menu items
  emit `tymar://tray-action` back to the frontend, which performs the API
  call. The Rust 30s tick loop is gone.
- Legacy drain: `get_legacy_pending` / `clear_legacy_pending` surface the
  old version's queued closed segments; the frontend uploads them once
  (acks only after success, so retries are safe). `timer-state.json`
  survives only as this drain target; `timer.rs` shrank to serde shapes +
  load/save/clear (3 unit tests).
- Entries freshness: `use-time-entries` also subscribes to realtime, so
  Today/This week cards and the Times list update on any device's stop.
  Home's Today card is now day-scoped (closed entries + live open elapsed).

### Phase 5 — Dashboard analytics/history/editing (uncommitted)

- `@packages/domain/src/analytics.ts` (exported from index + package
  exports): `entryDurationMs`, midnight-split `aggregateDayTotals`,
  `totalsForDay`/`sumDayTotals`, `lastNDayKeys`, `aggregateByProject`,
  `groupEntriesByStartDay`. Duration is always derived from timestamps.
- Web `lib/db.ts`: `toTimeEntry`, `listTimeEntries` (task/type/date
  filters, 500 cap), `create/update/deleteTimeEntry` (end-after-start
  validation, timestamps edited → duration derived), `updateProfile`
  (name/timezone with `Intl` validation); `listTasks`/`listProjects` gained
  `includeDeleted` so history can name deleted tasks/projects.
- Web overview (`/dashboard`): Today / last-7-days / all-time cards, 7-day
  work-vs-break bar chart, top-5 projects, 5 recent sessions — all grouped
  in the profile timezone with device-zone fallback.
- Web history (`/dashboard/time`): search + project/type/date-range
  filters, day-grouped entries with midnight-split day totals, edit dialog
  (task/type/start/end via `datetime-local`, browser-local → UTC ISO),
  delete confirm, manual "Log time" for corrections.
- Web settings (`/dashboard/settings`): display-name + reporting-timezone
  editing over `ensureUserSetup`/`getProfile`, `datalist` of
  `Intl.supportedValuesOf("timeZone")`, device-zone shortcut, email
  read-only.
- Desktop: `lib/db.ts` gained `getProfile`/`listTimeEntries`;
  `hooks/use-time-entries.ts` feeds the History tab (read-only day groups
  with totals, last 14 days) and the Today "This week" card (synced
  last-7-day work/break in the profile zone; offline keeps last value).
- Verified headless: `pnpm check-types`, `eslint --max-warnings 0`
  (web + desktop), fresh `next` + `vite` builds.

## 4. OAuth hardening trail (why auth looks the way it does)

1. Webview-embedded OAuth → replaced: users are already signed in to
   their real browser (RFC 8252 pattern).
2. Loopback server (`127.0.0.1:<port>/callback`) → replaced: works, but
   the official guide path (deep link) was requested.
3. Rust REST auth (`Cookie`, then `X-Appwrite-Session`) → both arrived as
   `role: guests`; root cause never isolated headlessly, so per the
   explicit directive Rust does **zero** networking now — session + I/O
   live in the proven webview SDK.
4. `register_all()` crashed macOS startup → OS-gated (Windows/Linux
   only; macOS uses the bundled Info.plist).
5. Appwrite 400 on `tymar://` success URL (platform form takes real
   hostnames only) → **web bridge** `/auth/desktop` forwards to the
   scheme. No console changes needed.
6. Better errors: Rust-era auth errors carried method/path/status/server
   type (the `role: guests` message cracked the cookie case).
7. Dev fallback: the bridge shows a copyable `tymar://auth` link and the
   desktop login accepts a pasted link (deep link or bridge URL — both
   carry userId+secret), so auth is testable without an installed bundle.

## 5. Verified vs needs-human-testing

Verified headless (in CI-repeatable form): `cargo check/clippy/test`,
`tsc`, `eslint --max-warnings 0`, fresh `vite` + `next` builds; SDK
source cross-checks (cookie name, OAuth/token paths, CORS reflection of
`tauri://localhost`); bundled `Info.plist` contains `tymar://`.

Needs a human (in order):
1. Desktop sign-in end-to-end (bundled app receives `tymar://`; dev
   binaries use the paste-the-link fallback on the login screen).
2. Phase 6 acceptance (two devices signed into the same account):
   start on A → B shows it running within ~a second and keeps counting;
   stop/break/resume/switch on B → A follows live; B start while A runs is
   impossible (start button unreachable while an entry is open).
3. Offline start → error toast, nothing created; offline stop → error,
   timer keeps running, closes fine once back online.
4. Tray workflow with the window closed (pushes arrive while hidden).
5. Upgrade path: run the pre-Phase-6 build with a queued stop, update,
   confirm the legacy pending segments land in Appwrite once.

## 6. Remaining work

- Post-MVP backlog (per PRD): global shortcuts, idle detection (opt-in),
  notifications, integrations, richer dashboard, cron hard-delete of
  soft-deleted projects, offline SQLite cache (intentionally absent — the
  timer is online-only by design now), stale open-entry reconciliation UX
  (a hard device death leaves the entry open; cloud truth = running, fix
  times manually via the web dashboard).
- Release-time flags: production desktop builds must bake the deployed
  web URL into `VITE_WEB_URL` (dev default `localhost:3010`); updater
  signing key for bundles (`--no-sign` used for local test bundles).

## 7. Runbook

```bash
pnpm install
# root .env.local: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
pnpm provision:appwrite   # idempotent backend setup
pnpm dev:web              # http://localhost:3010
pnpm dev:desktop          # needs rebuilt Rust after backend changes
```

Commit history (`git log --oneline`): initial → Phase 0+1 → Phase 2 →
UX round → Today redesign → Phase 3 → Phase 4 → login/config fixes →
browser OAuth → error surfacing → X-Appwrite-Session → official
deep-link rewire → macOS register fix → web bridge.
