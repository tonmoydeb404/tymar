# @apps/web

Next.js marketing site for Tymar, plus the authenticated web dashboard.

## Where things live

- **Marketing copy** — `src/content/`:
  - `homepage.ts` — hero, capabilities, features, workflow, FAQ, footer
  - `features.ts` — the /features index entries
  - `docs.ts` — the docs pages rendered at /docs/[slug]
  - `comparisons.ts` — the /alternatives comparison pages
  - `changelog.ts` — the release timeline at /changelog (newest first)
- **Legal copy** — `src/views/privacy/sections/` and `src/views/terms/sections/`
- **Routes & URLs** — `src/config/paths-config.ts` (generated brand values are
  between the `@brand:generated-start/end` markers; run `pnpm sync-brand` after
  changing `brand.json`)
- **Downloads page** — `src/views/download/sections/` (install scripts come
  from `brand.json` via `src/config/scripts-config.ts`)

## Development

```sh
pnpm dev:web
```

Requires the Supabase environment variables from `.env` — see the repo root
README and `supabase/migrations` for setup.
