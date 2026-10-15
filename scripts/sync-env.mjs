// Reads a single root .env.local (then .env) and distributes the values
// to each app's env file so you never have to maintain duplicates.
//
// Root variable names → app-specific names:
//
//   SUPABASE_URL              → NEXT_PUBLIC_SUPABASE_URL        (web)
//                             → VITE_SUPABASE_URL               (desktop)
//
//   SUPABASE_PUBLISHABLE_KEY  → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (web)
//                             → VITE_SUPABASE_PUBLISHABLE_KEY          (desktop)
//
//   SITE_URL                  → NEXT_PUBLIC_SITE_URL            (web)
//                             → VITE_WEB_URL                    (desktop)
//
// Root-only (used by migration script, never distributed):
//   SUPABASE_SECRET_KEY, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
//
// Run with:
//   pnpm sync-env

import dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL("..", import.meta.url).pathname;

// .env.local takes priority over .env
dotenv.config({ path: [resolve(root, ".env.local"), resolve(root, ".env")] });

const get = (key) => process.env[key] ?? "";

let hasErrors = false;
function required(key) {
  const v = get(key);
  if (!v) {
    console.error(`  ✗ Missing required variable: ${key}`);
    hasErrors = true;
  }
  return v;
}

// ─── Variables ────────────────────────────────────────────────────────────────

const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_PUBLISHABLE_KEY = required("SUPABASE_PUBLISHABLE_KEY");
const SITE_URL = get("SITE_URL") || "http://localhost:3010";

if (hasErrors) {
  console.error("\nFix the missing variables in .env.local and re-run.");
  process.exit(1);
}

// ─── Target files ─────────────────────────────────────────────────────────────

const targets = [
  {
    path: resolve(root, "apps/web/.env.local"),
    label: "apps/web/.env.local",
    content:
      [
        `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
        `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}`,
        `NEXT_PUBLIC_SITE_URL=${SITE_URL}`,
      ].join("\n") + "\n",
  },
  {
    path: resolve(root, "apps/desktop/.env"),
    label: "apps/desktop/.env",
    content:
      [
        `VITE_SUPABASE_URL=${SUPABASE_URL}`,
        `VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY}`,
        `VITE_WEB_URL=${SITE_URL}`,
      ].join("\n") + "\n",
  },
];

// ─── Write ────────────────────────────────────────────────────────────────────

for (const { path, label, content } of targets) {
  writeFileSync(path, content, "utf8");
  console.log(`  ✓ ${label}`);
}

console.log("\nDone. Both apps share the same Supabase config.");
