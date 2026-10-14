"use client";

import { useAuth } from "@/lib/auth-context";
import { ensureUserSetup, getProfile } from "@/lib/db";
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
      const profile = await getProfile(user.id);
      if (!cancelled) setOpen(!profile);
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
      open={open}
      onOpenChange={() => {}}
      title="Set up your workspace"
      description="We'll create your profile so you can start tracking time."
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
