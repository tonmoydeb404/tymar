import { useAuth } from "@/lib/auth-context";
import {
  ensureUserSetup,
  getProfile,
  getPublicStatusSettings,
  regeneratePublicSlug,
  setPublicStatusEnabled,
  updateProfile,
  type PublicStatusSettings,
} from "@/lib/db";
import { siteUrl } from "@/lib/supabase";
import { useAsyncAction } from "@/lib/use-async-action";
import type { Profile } from "@packages/domain/index";
import { useCallback, useEffect, useState } from "react";

/** All settings state and actions in one place: profile + timezone form,
 * public status settings, and their async actions. The page component only
 * renders what this hook returns. */
export function useSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [statusSettings, setStatusSettings] = useState<PublicStatusSettings | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const {
    run: reloadRun,
    isLoading: reloadLoading,
    error: reloadError,
  } = useAsyncAction(
    useCallback(async () => {
      if (!user) return;
      const { profile: ensured } = await ensureUserSetup({
        userId: user.id,
        name: user.user_metadata?.full_name ?? user.email ?? "",
        email: user.email ?? "",
      });
      const full = (await getProfile(user.id)) ?? ensured;
      setProfile(full);
      setName(full.name);
      setTimezone(full.timezone);
      try {
        setStatusSettings(await getPublicStatusSettings(user.id));
      } catch {
        setStatusSettings(null);
      }
    }, [user]),
  );

  useEffect(() => {
    void reloadRun().catch(() => {});
  }, [reloadRun]);

  const dirty =
    profile !== null &&
    (name.trim() !== profile.name || timezone !== profile.timezone);

  const save = useAsyncAction(
    useCallback(async () => {
      if (!profile) throw new Error("Settings are still loading.");
      const saved = await updateProfile(profile.userId, {
        name: name.trim(),
        timezone: timezone.trim(),
      });
      setProfile(saved);
      setName(saved.name);
      setTimezone(saved.timezone);
      setSavedNote(`Saved — day totals now group by ${saved.timezone}.`);
    }, [profile, name, timezone]),
  );

  const togglePublic = useAsyncAction(
    useCallback(async (checked: boolean) => {
      await setPublicStatusEnabled(checked);
      setStatusSettings((prev) =>
        prev ? { ...prev, isPublic: checked } : prev,
      );
    }, []),
  );

  const regenerate = useAsyncAction(
    useCallback(async () => {
      if (!user) throw new Error("Not signed in.");
      const slug = await regeneratePublicSlug();
      setStatusSettings({ userId: user.id, slug, isPublic: true });
      setCopied(false);
      return slug;
    }, [user]),
  );

  const copyLink = useCallback(async () => {
    const url = statusSettings
      ? `${siteUrl()}/api/status/${statusSettings.slug}`
      : null;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy failed — select the link text manually.");
    }
  }, [statusSettings]);

  const statusUrl = statusSettings
    ? `${siteUrl()}/api/status/${statusSettings.slug}`
    : null;

  function applyDeviceZone() {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Device zone unreadable — leave the field alone.
    }
  }

  return {
    // Session
    email: user?.email ?? null,

    // Load state
    profile,
    loading: reloadLoading || (profile === null && !reloadError),
    loadError: reloadError,
    reload: reloadRun,

    // Profile + timezone form
    name,
    setName,
    timezone,
    setTimezone,
    applyDeviceZone,
    dirty,
    save: save.run,
    saving: save.isLoading,
    saveError: save.error,
    savedNote,

    // Public status
    statusSettings,
    statusUrl,
    statusBusy: togglePublic.isLoading || regenerate.isLoading,
    statusError: togglePublic.error ?? regenerate.error ?? copyError,
    togglePublic: togglePublic.run,
    regenerate: regenerate.run,
    copied,
    copyLink,
  };
}
