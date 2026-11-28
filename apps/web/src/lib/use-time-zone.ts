"use client";

import { useAuth } from "@/lib/auth-context";
import { getProfile } from "@/lib/db";
import { useEffect, useState } from "react";

function deviceZone(): string {
  return typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";
}

/** The user's reporting timezone (profile setting, else the device's).
 * Every date filter is interpreted in this zone, so "this week" and the
 * day boundaries match what the user sees on their clock. Starts on the
 * device zone so the common case never refetches. */
export function useTimeZone(): string {
  const { user } = useAuth();
  const [timeZone, setTimeZone] = useState(deviceZone);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getProfile(user.id).then((profile) => {
      if (!cancelled && profile?.timezone) setTimeZone(profile.timezone);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return timeZone;
}
