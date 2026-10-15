import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, onDeepLinkEvent, onUpdateAvailable } from "../lib/api";
import { desktopScheme } from "../lib/config";
import {
  getSupabaseClient,
  initiateGoogleOAuth,
  isSupabaseConfigured,
} from "../lib/supabase";
import { runSync } from "../lib/sync";
import type { AuthState, AuthUser, UpdateInfo } from "../types";

type SignInResult = { ok: true } | { ok: false; message: string };

type AppContextValue = {
  loading: boolean;
  error: string | null;

  auth: AuthState | null;
  signingIn: boolean;
  signIn: () => Promise<SignInResult>;
  /**
   * Dev fallback: paste the sign-in link (the `tymar://auth?...` deep link
   * or the `/auth/desktop?...` bridge URL) when the OS can't route the
   * scheme back to an uninstalled dev binary. Parses `?code=` out of any
   * pasted URL and exchanges it for a Supabase session.
   */
  completeSignInWithUrl: (raw: string) => Promise<SignInResult>;
  /** Clears a stuck `signingIn` flag, e.g. when the user abandons the OAuth
   * redirect and switches to pasting the link manually. */
  resetSigningIn: () => void;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;

  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => Promise<void>;

  updateInfo: UpdateInfo | null;
  isInstallingUpdate: boolean;
  dismissUpdate: () => void;
  installUpdate: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function toUser(data: {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
}): AuthUser {
  return {
    id: data.id,
    name: data.user_metadata?.full_name ?? data.email ?? "",
    email: data.email ?? "",
    avatarUrl:
      data.user_metadata?.avatar_url ?? data.user_metadata?.picture ?? null,
  };
}

/** Both the scheme prefix (e.g. `tymar://auth` or `tymar-dev://auth`). */
const AUTH_DEEP_LINK_PREFIX = `${desktopScheme}://auth`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  // ---- Auth (Supabase PKCE session) ----

  const refreshAuth = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      setAuth({ configured: false, status: "unknown", user: null });
      return;
    }
    try {
      const { data, error: err } = await sb.auth.getUser();
      if (err || !data.user) {
        setAuth({ configured: true, status: "expired", user: null });
      } else {
        setAuth({ configured: true, status: "active", user: toUser(data.user) });
      }
    } catch {
      setAuth({ configured: true, status: "unknown", user: null });
    }
  }, []);

  // Handles both PKCE (?code=) and implicit (?access_token=&refresh_token=)
  // deep link payloads and establishes a Supabase session from either.
  const completeAuthUrl = useCallback(
    async (raw: string): Promise<SignInResult> => {
      let params: URLSearchParams;
      try {
        params = new URL(raw.trim()).searchParams;
      } catch {
        return { ok: false, message: "That link couldn't be read as a URL." };
      }

      const sb = getSupabaseClient();
      if (!sb) return { ok: false, message: "Supabase is not configured." };

      try {
        const code = params.get("code");
        if (code) {
          const { error: err } = await sb.auth.exchangeCodeForSession(code);
          if (err) return { ok: false, message: err.message };
          await refreshAuth();
          return { ok: true };
        }

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: err } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (err) return { ok: false, message: err.message };
          await refreshAuth();
          return { ok: true };
        }

        return { ok: false, message: "Google sign-in failed or was cancelled." };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [refreshAuth],
  );

  const handleAuthUrls = useCallback(
    async (urls: string[]) => {
      for (const raw of urls) {
        if (!raw.startsWith(AUTH_DEEP_LINK_PREFIX)) continue;
        const result = await completeAuthUrl(raw);
        if (result.ok) {
          toast.success("Signed in.");
        } else if (
          result.message === "Google sign-in failed or was cancelled."
        ) {
          toast.error(result.message);
        } else {
          toast.error("Couldn't finish sign-in.", {
            description: result.message,
          });
        }
        setSigningIn(false);
      }
    },
    [completeAuthUrl],
  );

  const completeSignInWithUrl = useCallback(
    async (raw: string): Promise<SignInResult> => {
      setSigningIn(true);
      try {
        const result = await completeAuthUrl(raw);
        if (result.ok) toast.success("Signed in.");
        return result;
      } finally {
        setSigningIn(false);
      }
    },
    [completeAuthUrl],
  );

  // ---- Data loading ----

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const backendSettings = await api.getSettings();
        if (cancelled) return;
        setSettings(backendSettings);
        await refreshAuth();
        // Cold start via deep link (app launched by the OAuth redirect).
        const current = await getCurrent().catch(() => null);
        if (!cancelled && current && current.length > 0) {
          await handleAuthUrls(current);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshAuth, handleAuthUrls]);

  // ---- Background sync (push dirty rows + pull latest from Supabase) ----

  useEffect(() => {
    const sb = getSupabaseClient();
    const userId = auth?.user?.id;
    if (!sb || !userId) return;

    // Touch open entries first so the sync that follows publishes a fresh
    // updated_at — the public status API treats stale open entries as offline.
    const syncNow = () => {
      void api.touchActiveTimeEntries(userId).catch(() => {});
      void runSync(sb, userId);
    };

    syncNow();

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(syncNow, 5 * 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [auth?.user?.id]);

  // ---- Event listeners ----

  useEffect(() => {
    const sb = getSupabaseClient();
    let unlistenAuthState: (() => void) | undefined;
    if (sb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setAuth({ configured: true, status: "active", user: toUser(session.user) });
        } else {
          setAuth((prev) =>
            prev?.status === "active"
              ? { configured: true, status: "expired", user: null }
              : prev,
          );
        }
      });
      unlistenAuthState = () => data.subscription.unsubscribe();
    }

    const unlistenUpdatePromise = onUpdateAvailable((payload) => {
      setUpdateInfo(payload);
    });
    const unlistenUrlPromise = onOpenUrl((urls) => {
      void handleAuthUrls(urls);
    });
    const unlistenDeepLinkPromise = onDeepLinkEvent((urls) => {
      void handleAuthUrls(urls);
    });

    return () => {
      unlistenAuthState?.();
      unlistenUpdatePromise.then((fn) => fn());
      unlistenUrlPromise.then((fn) => fn());
      unlistenDeepLinkPromise.then((fn) => fn());
    };
  }, [handleAuthUrls]);

  // ---- Auth actions ----

  const signIn = useCallback(async (): Promise<SignInResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase is not configured." };
    }
    setSigningIn(true);
    try {
      const url = await initiateGoogleOAuth();
      if (!url) {
        setSigningIn(false);
        return { ok: false, message: "Couldn't get a sign-in URL." };
      }
      await openUrl(url);
      toast.info("Continue in your browser to finish sign-in.");
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSigningIn(false);
      return { ok: false, message };
    }
  }, []);

  const resetSigningIn = useCallback(() => setSigningIn(false), []);

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    try {
      if (sb) await sb.auth.signOut();
    } catch (err) {
      toast.error("Failed to sign out", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSigningIn(false);
    }
    await refreshAuth();
  }, [refreshAuth]);

  // ---- Settings ----

  const updateSetting = useCallback(async (key: string, value: string) => {
    await api.setSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ---- Updater ----

  const dismissUpdate = useCallback(() => setUpdateInfo(null), []);

  const installUpdate = useCallback(async () => {
    setIsInstallingUpdate(true);
    try {
      await api.installUpdate();
    } catch (err) {
      toast.error("Failed to install update", {
        description: err instanceof Error ? err.message : String(err),
      });
      setIsInstallingUpdate(false);
    }
  }, []);

  const value: AppContextValue = {
    loading,
    error,
    auth,
    signingIn,
    signIn,
    completeSignInWithUrl,
    resetSigningIn,
    signOut,
    refreshAuth,
    settings,
    updateSetting,
    updateInfo,
    isInstallingUpdate,
    dismissUpdate,
    installUpdate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (context === null) {
    throw new Error("useApp must be used within an AppProvider");
  }

  return context;
}
