"use client";

import { useAuth } from "@/lib/auth-context";
import { ensureUserSetup, profileExists } from "@/lib/db";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { useCallback, useEffect, useState } from "react";

export function SetupModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const exists = await profileExists(user.id);
        if (!cancelled) setOpen(!exists);
      } catch {
        // Lookup failed (offline, server hiccup) — don't claim the profile
        // is missing; the next page load checks again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleConfirm = useCallback(async () => {
    if (!user) return;
    setSettingUp(true);
    setError(null);
    try {
      await ensureUserSetup({
        userId: user.id,
        name: user.user_metadata?.full_name ?? user.email ?? "",
        email: user.email ?? "",
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSettingUp(false);
    }
  }, [user]);

  return (
    <ResponsiveSheet
      variant="dialog"
      size="sm"
      open={open}
      onOpenChange={() => {}}
      title="Finish setting up"
      description={`We'll create your profile (timezone: ${
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC"
      }) so you can start tracking time. You can change the timezone later in Settings.`}
      footer={
        <Button className="w-full" disabled={settingUp} onClick={handleConfirm}>
          {settingUp ? "Setting up…" : "Get started"}
        </Button>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ResponsiveSheet>
  );
}
