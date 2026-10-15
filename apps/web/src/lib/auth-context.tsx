"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { appPaths } from "@/config/paths-config";
import { createSupabaseClient, isSupabaseConfigured, siteUrl } from "./supabase";

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }
    const supabase = createSupabaseClient();
    try {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createSupabaseClient();
    void refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );
    return () => subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    const supabase = createSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl()}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    router.push(appPaths.login);
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ loading, user, signIn, signOut, refresh }),
    [loading, user, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
