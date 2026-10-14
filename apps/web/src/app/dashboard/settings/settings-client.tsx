"use client";

import { useAuth } from "@/lib/auth-context";
import { ensureUserSetup, getProfile, updateProfile } from "@/lib/db";
import type { Profile } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { useCallback, useEffect, useMemo, useState } from "react";

function allTimeZones(): string[] {
  try {
    const values = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (values && values.length > 0) return values;
  } catch {
    // Fall through to the curated list.
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Kyiv",
    "Africa/Cairo",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

export function SettingsClient() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const zones = useMemo(allTimeZones, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { profile: ensured } = await ensureUserSetup({
        userId: user.id,
        name: user.user_metadata?.full_name ?? user.email ?? '',
        email: user.email ?? "",
      });
      const full = (await getProfile(user.id)) ?? ensured;
      setProfile(full);
      setName(full.name);
      setTimezone(full.timezone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load settings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!user) return null;

  const dirty =
    profile !== null &&
    (name.trim() !== profile.name || timezone !== profile.timezone);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      const saved = await updateProfile(user!.id, {
        name: name.trim(),
        timezone: timezone.trim(),
      });
      setProfile(saved);
      setName(saved.name);
      setTimezone(saved.timezone);
      setSavedNote(`Saved — day totals now group by ${saved.timezone}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  function useDeviceZone() {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Device zone unreadable — leave the field alone.
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-1 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile and reporting timezone.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error && !profile ? (
        <div className="grid gap-2 rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Profile</CardTitle>
              <CardDescription>
                Shown across the dashboard; your login email can&apos;t be
                changed here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="settings-name">Display name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  value={user.email}
                  disabled
                  readOnly
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Reporting timezone
              </CardTitle>
              <CardDescription>
                Day boundaries for analytics and history. Timestamps stay in UTC
                under the hood.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="settings-tz">Timezone</Label>
                <Input
                  id="settings-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  list="tz-options"
                  placeholder="America/New_York"
                  autoComplete="off"
                />
                <datalist id="tz-options">
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={useDeviceZone}>
                  Use device timezone
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {savedNote && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {savedNote}
            </p>
          )}

          <div>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
