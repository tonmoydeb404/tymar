# Tymar

Effortless time tracking for focused work — a minimal, powerful time tracker
for macOS, Windows, and Linux. Start a session from the system tray, take
breaks without losing your thread, and let Tymar keep the record.

<!-- @brand:start badges -->

[![Release](https://img.shields.io/github/v/release/tonmoydeb404/tymar)](https://github.com/tonmoydeb404/tymar/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](#download)

<!-- @brand:end badges -->

## Features

- **One-click tracking** — start, stop, switch, and take breaks from the tray
  menu; a compact window keeps the session visible
- **Projects and tasks** — organize entries by project and task, with quick
  search and a command palette (⌘/Ctrl K)
- **Local-first** — session state and settings live on your device in SQLite;
  sign in to sync projects, tasks, and history
- **Cross-platform** — native builds for macOS (Apple Silicon), Windows (x64),
  and Linux (deb)
- **Automatic updates** — built-in updater checks GitHub Releases and lets you
  install new versions with one click

## Download

<!-- @brand:start downloadLink -->

[Download the latest release &raquo;](https://github.com/tonmoydeb404/tymar/releases/latest)

<!-- @brand:end downloadLink -->

Or install from the terminal:

```sh
# macOS (Apple Silicon) and Linux (x86_64 deb)
curl -fsSL https://raw.githubusercontent.com/tonmoydeb404/tymar/main/setup/unix.sh | sh

# Windows (x64)
irm https://raw.githubusercontent.com/tonmoydeb404/tymar/main/setup/windows.ps1 | iex
```

## Development

```sh
pnpm install
pnpm dev:desktop   # Tauri dev (React frontend + Rust backend)
pnpm dev:web       # Next.js marketing/dashboard site
```

Type checks and linting:

```sh
pnpm check-types
pnpm lint
```

### Repository layout

```
├── apps/
│   ├── desktop/        # Tauri 2 app (React frontend + Rust backend)
│   └── web/            # Next.js marketing site + dashboard
├── packages/
│   ├── ui/             # Shared shadcn-style component kit
│   ├── domain/         # Shared domain types
│   ├── eslint-config/
│   └── typescript-config/
├── scripts/            # sync-brand, Appwrite→Supabase migration, release tooling
├── Casks/              # Homebrew cask (auto-updated on release)
├── setup/              # curl|sh / irm|iex installers
└── brand.json          # ★ single source of truth for branding + version
```

## Branding: edit one file

Change `brand.json`, then run `pnpm sync-brand` (the pre-commit hook does this
for you). It propagates to `tauri.conf.json` (name, identifier, deep-link
scheme, updater endpoint), `Cargo.toml`/`Cargo.lock`, crate names in
`main.rs`, package.json files, `index.html`, the generated `brand.ts`/`brand.rs`,
the Homebrew cask, setup scripts, and README badges. CI fails
(`pnpm sync-brand:check`) if anything drifts.

## Releasing

```sh
pnpm release:tag patch   # bumps brand.json, syncs, commits, tags, pushes
```

The tag push triggers the release workflow: dmg + deb + msi/exe with updater
artifacts, then updates the Homebrew cask with the new sha256.

## License

MIT — see [LICENSE](./LICENSE).
