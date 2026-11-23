export type ChangelogEntry = {
  version: string;
  date: string;
  summary: string;
  highlights: string[];
};

// Each shipped version appends an entry here; release downloads always live on
// GitHub Releases. Entries are newest-first.
export const changelog: ChangelogEntry[] = [
  {
    version: "v0.3.2 — Pure menu-bar app: no Dock icon, ever",
    date: "2026-11-24",
    summary:
      "Tymar now lives only in the menu bar on macOS. Opening the window used to put the app in the Dock, and closing it never gave the Dock slot back — now every launch path stays Dock-less, from install to login auto-start.",
    highlights: [
      "No Dock icon on any path: normal launch, the tray's \"Open\", auto-start at login, and relaunching while already running all keep the app out of the Dock and ⌘Tab.",
      "Closing the window now collapses straight back to the menu bar — previously the Dock icon stuck around after the window was closed.",
      "The app declares LSUIElement, so it's an agent app from the instant of launch — no brief Dock flash on login auto-start.",
      "Quit still lives in the tray menu — the standard way out of a Dock-less app.",
    ],
  },
  {
    version: "v0.3.1 — Tracked time is never lost",
    date: "2026-11-22",
    summary:
      "A fix for the worst kind of bug: leaving the device with the timer running could stop it and throw away the hours it had counted. Every automatic stop now commits exactly what was counted — and tells you how much.",
    highlights: [
      "Sleep and power-off stops commit the exact counted time: the stop only fires when the system really slept, and the entry ends at the moment of sleep — never at a stale timestamp.",
      "Hidden-window throttling (App Nap) no longer triggers phantom stops — while a timer runs, the app keeps counting accurately even with the window closed.",
      "Auto-resume is gone: after sleep the timer stays off, with a toast showing what was logged before the break (\"Timer stopped while you were away. Logged 2h 13m before that.\").",
      "Sessions started offline now reach the cloud when closed, instead of silently living only on one device.",
    ],
  },
  {
    version: "v0.3.0 — Sleep-aware timer & workspaces",
    date: "2026-11-21",
    summary:
      "The timer finally understands when you're gone: sleep, lid close, or a full shutdown no longer bill dead time. Projects can now live in workspaces — one per client or area — managed on the web dashboard and picked right from the desktop timer.",
    highlights: [
      "Stop on sleep: closing the lid or letting the system sleep closes the running timer at the moment of sleep, so sleep time is never counted.",
      "Auto-resume: on wake the timer restarts the same task and project — a toast tells you how long you slept and that it wasn't counted (Settings → Timer).",
      "Power-off protection: a heartbeat records the app's last alive moment; after a shutdown or crash the dead gap is never billed and the timer resumes on relaunch. Quick restarts and app updates don't interrupt a running timer.",
      "Workspaces: group projects per client or area on the web dashboard's Projects page — the desktop timer gets a workspace selector that narrows Start/Switch and manual entries to that workspace's projects.",
      "A Personal workspace is created automatically for every user (and every new signup) with all projects moved in — nothing is left ungrouped.",
      "Web forms now match the desktop app: required project, inline task creation, overlap protection, and workspace selectors everywhere.",
      "Native sleep detection on Windows and Linux, plus a Windows CI job so platform-specific code compiles on every pull request.",
    ],
  },
  {
    version: "v0.2.4 — Copy install commands in one click",
    date: "2026-11-04",
    summary:
      "The install and uninstall commands on the download page now have a click-to-copy button, so you can paste them straight into your terminal.",
    highlights: [
      "Copy buttons on the install and uninstall command blocks for macOS, Windows, and Linux on the download page.",
      "Hover to reveal the copy button (always visible on touch), with a check-mark confirmation on click.",
    ],
  },
  {
    version: "v0.2.3 — Auto-update, fixed",
    date: "2026-11-04",
    summary:
      "The in-app updater finally works. Every release so far was signed with a different key than the one installed apps trusted, so \"Install and Restart\" always failed verification. This build ships with the correct key — install it once manually and every future update is one click.",
    highlights: [
      "Fixes \"The signature was created with a different key than the one provided\", which blocked every update since v0.1.0.",
      "The app now embeds the same updater key the release pipeline actually signs with — verified against the published v0.2.2 artifacts.",
      "One-time step for existing users: download and install v0.2.3 manually; updates after that apply normally from Settings.",
      "Release notes are now composed from this changelog, so the update dialog always shows real release notes.",
    ],
  },
  {
    version: "v0.2.2 — Same font on every OS",
    date: "2026-11-04",
    summary:
      "One bundled typeface across all platforms, and timers stopped on another device now drop to idle instantly — no reload needed.",
    highlights: [
      "Geist (UI) and Geist Mono (timer digits) are bundled with the app, so Tymar renders identically on macOS, Windows, and Linux — even offline.",
      "Sessions stopped on the web or another device now reflect in realtime, and the entry keeps its true end time.",
      "The running-elsewhere list stays accurate on its own: stale entries clear without a reload.",
      "Take-over is gone — timers running on other devices are still visible, just view-only.",
    ],
  },
  {
    version: "v0.2.1 — Sync you can trust",
    date: "2026-10-26",
    summary:
      "A rebuilt sync engine that reports what actually happened, with per-row health tracking and a stop that can't wedge.",
    highlights: [
      "Honest push/pull engine: every change is acknowledged per row, and failures surface instead of silently dropping.",
      "Sync health is tracked per row in SQLite, with a status pill on Home.",
      "Un-wedgeable stop: closing falls back to a cloud close when no local open row exists.",
      "An \"Already running\" banner lists timers started on other devices, with take-over (removed again in v0.2.2).",
    ],
  },
  {
    version: "v0.2.0 — Supabase migration",
    date: "2026-10-15",
    summary:
      "The whole stack moved to Supabase — web and desktop — with offline-first sync on the desktop.",
    highlights: [
      "Data layer and auth migrated from Appwrite to Supabase across web and desktop.",
      "Desktop keeps an offline-first SQLite layer with background push/pull sync.",
      "Live timer readout in the macOS menubar.",
      "Reconnect-aware realtime replaces polling for timer sync.",
      "Web dashboard gains a timer screen, timeline view, and a public status API.",
    ],
  },
  {
    version: "v0.1.3 — Deep links & polish",
    date: "2026-09-25",
    summary:
      "Cross-device deep links, a manual update check, and polish across settings, times, and theming.",
    highlights: [
      "tymar:// deep links work across devices, with a Linux desktop entry for registration.",
      "Manual update check in Settings.",
      "User menu with dropdown actions and a grouped time table.",
      "Light is the default theme, and dev builds are titled with a Dev suffix.",
    ],
  },
  {
    version: "v0.1.2 — Cross-device timers",
    date: "2026-09-24",
    summary:
      "The running timer now syncs across devices, and manual entries can stay open-ended.",
    highlights: [
      "Starting a timer creates a live entry, so the running session syncs to your other devices.",
      "Manual entries can be open-ended, with overlap validation.",
      "Outfit / JetBrains Mono served locally for consistent Linux rendering.",
    ],
  },
  {
    version: "v0.1.1 — CI fix",
    date: "2026-09-23",
    summary: "A release-pipeline fix so tagged builds get everything they need.",
    highlights: [
      "CI injects public build variables into the Vite build step, so tagged releases build correctly.",
    ],
  },
  {
    version: "v0.1.0 — First release",
    date: "2026-09-23",
    summary:
      "Tymar's first public release: tray-first time tracking with projects, tasks, breaks, and a synced history.",
    highlights: [
      "Start, stop, switch, and take breaks from the system tray with a live elapsed-time readout.",
      "Projects and tasks with quick search and a command palette (⌘/Ctrl K).",
      "Local-first storage: session state and settings in SQLite on your device.",
      "Optional sign-in to sync projects, tasks, and entries with the web dashboard.",
      "Built-in auto-updates on macOS, Windows, and Linux.",
    ],
  },
];
