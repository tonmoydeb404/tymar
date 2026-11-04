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
