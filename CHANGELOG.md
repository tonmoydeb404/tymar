# Changelog

Notable changes to Tymar. Newest first — versions follow [SemVer](https://semver.org/), format loosely based on [Keep a Changelog](https://keepachangelog.com/). Every release is tagged on GitHub; installers for each version are attached to its [GitHub release](https://github.com/tonmoydeb404/tymar/releases).

## [v0.4.0] — 2026-11-28

### Added

- **Local-first desktop timer** — the timer runs against the local database first and syncs in the background, with incremental realtime sync, version-guarded sync acks, pruning of deleted rows, and graceful offline handling (offline launch, pending-change count, sign-out guard).
- **Quit-time save** — quitting with a running timer now asks what to do (save or discard) in a drawer, and stop/switch is applied at the moment you choose it.
- **Desktop redesign** — Home, Times, Settings and the start/manual-entry sheets were rebuilt, with hour/minute dropdowns (full 00–59 precision) and a responsive date-time picker.
- **Workspaces are required** — every project belongs to a workspace (existing data is backfilled) and the last active workspace can't be archived or deleted. The desktop app uses one global workspace.
- **Archive tasks** — tasks can be archived (Supabase migration `005_task_archived_status.sql`) and are hidden from lists and pickers until asked for. The web app gets a task board next to the list.
- **Web export builder** — export time data as collapsible step cards with reporting-timezone date ranges and a review-and-download dialog; large exports are much faster.
- **Web dashboard redesign** — new sidebar, settings split into Account, Workspaces and Public status pages, a dedicated Workspaces page, date-range presets (this week by default) and a DatePicker.
- **Per-tab workspace** — each browser tab keeps its own workspace; the timer shows which workspace it is running in, with a shortcut to switch to it.

### Changed

- Task pickers (desktop and web) only offer tasks from the current workspace and no longer show archived ones.
- Forms use shared core text, textarea, select and switch fields with a required marker; confirmation modals use a compact dialog.
- Smaller border radius, and no inverted translucent menus.

### Fixed

- Calendar and date-range picker sizing, hover/active/today states and mobile layout.
- Web timer button and overlay on mobile: dragging no longer scrolls the page, the overlay scrolls on short screens and respects safe areas, and the clock digits fit 360px phones.
- Desktop theme colour classes and quit/stop timing.

## [v0.3.2] — 2026-11-24

### Fixed

- **Tymar is now a pure menu-bar app on macOS — no Dock icon, ever.** Opening the window used to put the app in the Dock (normal launch, the tray's "Open", and relaunching while already running all did it), and closing the window only hid it, so the Dock icon stuck around. The app now always runs as an Accessory (agent) process: it lives only in the menu bar whether the window is open, closed, or launched at login.
- The bundled app declares `LSUIElement`, so it's an agent app from the instant of launch — the brief Dock flash on login auto-start is gone too. Quit remains in the tray menu, the standard way out of a Dock-less app.

## [v0.3.1] — 2026-11-22

### Fixed

- **Tracked time is no longer discarded on sleep or long absences** — leaving the device with the timer running could stop it and silently drop the hours it had counted:
  - The JS watchdog that backstops missed sleep events treated any webview timer stall (hidden-window throttling, App Nap) as sleep and closed the entry at a stale timestamp, discarding everything counted since. It now only stops the timer when Rust confirms a native suspend actually happened inside the gap, and commits at the suspend moment — never the stale tick.
  - The native suspend path now commits at the last moment the process was verifiably alive — the frozen heartbeat when the sleep notification only runs at wake — so the sleep window is never billed and pre-sleep time is never lost.
  - macOS: App Nap is prevented while a timer runs, so webview timers and the boot heartbeat stay accurate even when the window is hidden.
- Closing a session no longer moves an already-committed end time (the sleep guard's) to an older timestamp, and pushes the full closed row to the cloud — entries started offline reach the cloud when closed instead of silently living on one device.

### Changed

- **Auto-resume removed** — after sleep or a power gap the timer stays stopped and a toast shows exactly what was logged before the break ("Timer stopped while you were away. Logged 2h 13m before that."). The Settings → Timer "Auto-resume" toggle is gone.

## [v0.3.0] — 2026-11-21

### Added

- **Workspaces** — an optional grouping level above projects (e.g. two projects per client):
  - New `workspaces` table (SQLite `v4` + Supabase `003_workspaces.sql`), synced like every other table.
  - Web dashboard: workspace management on the Projects page (create, rename, archive, delete) with a workspace filter bar; new/edit project forms get a workspace field; the project table shows its workspace.
  - Desktop timer: a workspace selector beside the sync status — Start/Switch and manual-entry sheets cascade workspace → project → task and narrow to the chosen workspace. The last workspace is remembered across restarts.
  - A **Personal** workspace is created automatically for every user (existing users via migration backfill, new signups via trigger) with all projects moved in — no project is left ungrouped.
- **Sleep-aware timer** — the timer now stops when the machine does, on every platform:
  - macOS: NSWorkspace sleep/wake notifications; Windows: `WM_POWERBROADCAST` on a hidden message window; Linux: systemd-logind `PrepareForSleep` over D-Bus.
  - On suspend, Rust closes the running entries at the moment of sleep (webview-independent, offline-safe) and the tray goes idle.
  - **Power-off / crash protection**: a heartbeat file records the app's last alive moment; at next boot, entries left open across a >5 minute absence are closed at that heartbeat — dead time is never billed — and the timer resumes. Updater restarts don't interrupt a running timer.
  - **Auto-resume** on wake/boot with the same task and project (breaks stay breaks), with a toast showing how long you slept and that it wasn't counted.
  - Settings → Timer: "Stop on sleep" and "Auto-resume" toggles (both default on).
  - A JS watchdog backstop closes the timer if a sleep event is ever missed.
- Web dashboard forms now match the desktop app: project is required when logging time or starting the timer, tasks can be created inline from the task picker, manual entries that overlap the running timer or another entry are rejected, and workspace selectors appear in every form.
- New `ci-windows` GitHub Actions job — Windows-only Rust code is compile-checked on every pull request instead of surfacing at release time.

### Fixed

- Workspace selectors render the workspace name instead of its id (Base UI's `SelectValue` shows the raw value when the popup items aren't mounted).

## [v0.2.4] — 2026-11-04

### Added

- Click-to-copy buttons on the install and uninstall command blocks for macOS, Windows and Linux on the download page — hover to reveal (always visible on touch), with a check-mark confirmation on click.

## [v0.2.3] — 2026-11-04

### Fixed

- The in-app updater: every release so far was signed with a different key than installed apps trusted, so "Install and Restart" always failed verification ("The signature was created with a different key than the one provided"). This build embeds the same updater key the release pipeline actually signs with — verified against the published v0.2.2 artifacts.
- Release notes are now composed from the changelog, so the update dialog always shows real release notes.

### Changed

- One-time step for existing users: v0.2.3 must be installed manually; updates after that apply normally from Settings.

## [v0.2.2] — 2026-11-04

### Added

- Bundled **Geist** (UI) and **Geist Mono** (timer digits) fonts, so the app renders identically on macOS, Windows and Linux — and works offline. (v0.1.2 bundled Outfit/JetBrains Mono, but the web→Supabase migration dropped it; this restores cross-OS consistency with a new typeface.)

### Changed

- The "Already running" list is now view-only: timers running on other devices are still visible (and live-updating), but can no longer be adopted from the desktop app.
- Timer state now converges with the cloud's open list on every cloud check, with a sync-cycle backstop for missed realtime events.
- Realtime subscriptions use per-consumer channel names, making event delivery reliable.

### Fixed

- Sessions stopped on the web or another device now drop the desktop timer to idle **in realtime** — no reload needed — and the entry keeps its true end time.
- Stale leftovers no longer linger in the "Already running" list.
- Locally-created timers whose first push is still in flight are no longer misidentified as "stopped elsewhere".

### Removed

- The take-over action (added in v0.2.1).

## [v0.2.1] — 2026-10-26

### Added

- Sync health tracking: per-row sync status/errors in SQLite (v3 migration) and a sync status pill on Home.
- "Already running" banner listing timers started on other devices.
- Un-wedgeable stop: closing falls back to a cloud close when no local open row exists, so the timer can never stick in "running".
- Take-over of timers running elsewhere *(removed in v0.2.2)*.

### Changed

- Sync engine is honest: every push is acked per row, failures are surfaced instead of silently dropped, and rows past the retry cap wait for a manual retry.

## [v0.2.0] — 2026-10-15

### Added

- Supabase backend across web and desktop, with an offline-first SQLite layer on the desktop (background push/pull sync).
- Reconnect-aware realtime for timer sync (replaces polling).
- Live timer readout in the macOS menubar/tray.
- Web dashboard: timer screen, timeline view, and a public status API.
- Google avatar (with initials fallback) in account menus.

### Changed

- Data layer and auth migrated from Appwrite to Supabase (SSR sessions on web, desktop bridge for OAuth).
- Vendor chunks split to clear bundle-size warnings.

### Fixed

- Menubar timer label clears on stop.
- Stray window-level scrollbars in the desktop shell.

## [v0.1.3] — 2026-09-25

### Added

- Cross-device deep links (`tymar://`) with dynamic scheme handling, plus a Linux desktop entry for registration.
- Manual update check in Settings.
- User menu with dropdown actions; grouped time table component.
- Dev builds suffixed with "Dev" in the window title.

### Changed

- Light is the default theme; simplified theme toggle options.
- Removed the always-on-top window setting; refreshed marketing/CTA links.

## [v0.1.2] — 2026-09-24

### Added

- Live (open-ended) time entries created on start, enabling cross-device sync of the running timer.
- Open-ended manual entries with overlap validation; dialog variant for compact forms.

### Fixed

- Outfit / JetBrains Mono served locally for consistent Linux rendering.

## [v0.1.1] — 2026-09-23

### Fixed

- CI injects public build variables into the Vite build step, so tagged releases build correctly.

## [v0.1.0] — 2026-09-23

### Added

- Initial public release: Tymar identity (renamed from "My App") with new logo and icons.
- Desktop time tracking: live timer with tray control ("Start Timer" from the menu), today/week summaries, breaks, task switching.
- Projects and tasks management (CRUD, data table, quick-add), manual entries with editing and deletion, date range picker.
- Web dashboard: OAuth sign-in, analytics, history/editing, settings, paste-link auth fallback.
- Theming with light/dark toggle; responsive sheets and a shared UI kit.

[v0.2.2]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.2.2
[v0.2.1]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.2.1
[v0.2.0]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.2.0
[v0.1.3]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.1.3
[v0.1.2]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.1.2
[v0.1.1]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.1.1
[v0.1.0]: https://github.com/tonmoydeb404/tymar/releases/tag/v0.1.0
