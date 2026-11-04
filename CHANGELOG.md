# Changelog

Notable changes to Tymar. Newest first — versions follow [SemVer](https://semver.org/), format loosely based on [Keep a Changelog](https://keepachangelog.com/). Every release is tagged on GitHub; installers for each version are attached to its [GitHub release](https://github.com/tonmoydeb404/tymar/releases).

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
