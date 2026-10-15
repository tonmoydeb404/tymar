import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { desktopBridgeUrl, supabasePublishableKey, supabaseUrl } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any> | null {
  if (client !== undefined) return client;
  client =
    supabaseUrl && supabasePublishableKey
      ? createClient(supabaseUrl, supabasePublishableKey)
      : null;
  return client;
}

export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabasePublishableKey.length > 0;
}

/** Initiates Google OAuth. Returns the URL to open in the system browser,
 * with the PKCE code verifier stored in the webview's localStorage.
 *
 * Always redirects via the web bridge (/auth/desktop), which then forwards
 * the code to the app via the registered deep link scheme. Works in both dev
 * (local web server) and prod (deployed web app). */
export async function initiateGoogleOAuth(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: desktopBridgeUrl,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return null;
  return data.url;
}
