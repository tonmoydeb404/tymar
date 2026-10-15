import { envConfig } from "@/config/env-config";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseClient() {
  return createBrowserClient(
    envConfig.SUPABASE.URL,
    envConfig.SUPABASE.PUBLISHABLE_KEY,
  );
}

export function isSupabaseConfigured(): boolean {
  return !!(envConfig.SUPABASE.URL && envConfig.SUPABASE.PUBLISHABLE_KEY);
}

export function siteUrl(): string {
  return envConfig.SITE_URL?.replace(/\/$/, "") || "http://localhost:3010";
}
