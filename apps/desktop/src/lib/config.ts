// Build-time client config (Vite `.env`). These values are compiled into
// the webview bundle only — Rust never sees them (it performs no network calls).
import { brand } from "./brand";

function requiredEnv(name: string, fallback: string): string {
  const value = import.meta.env[name] as string | undefined;
  return value && value.trim().length > 0 ? value : fallback;
}

export const supabaseUrl = requiredEnv("VITE_SUPABASE_URL", "");
export const supabasePublishableKey = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

export const webUrl = requiredEnv(
  "VITE_WEB_URL",
  "http://localhost:3010",
).replace(/\/$/, "");

// Dev builds use a separate scheme so they coexist with the installed production app.
export const desktopScheme = import.meta.env.DEV
  ? `${brand.slug}-dev`
  : brand.slug;

// OAuth lands on the web bridge which forwards the code to the app via deep link.
// Must be in Supabase → Auth → URL Configuration → Redirect URLs.
// Dev:  http://localhost:3010/auth/desktop
// Prod: https://your-domain.com/auth/desktop
export const desktopBridgeUrl = `${webUrl}/auth/desktop?scheme=${encodeURIComponent(desktopScheme)}`;
