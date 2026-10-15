"use client";

import { Button } from "@packages/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Check,
  Copy,
  Radio,
  RefreshCw,
  User,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useSettings } from "./use-settings";

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

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function CardTitleLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: string;
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </CardTitle>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-3 w-20" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[3.75rem]" />
            <Skeleton className="h-[3.75rem]" />
          </div>
          <Skeleton className="h-[3.75rem]" />
          <Skeleton className="ml-auto h-9 w-32" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-3 w-28" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-11" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsClient() {
  const s = useSettings();
  const zones = useMemo(allTimeZones, []);

  if (!s.email && !s.profile) return null;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-64 overflow-hidden"
      >
        <div className="absolute left-[12%] top-0 size-56 rounded-full bg-primary/10 blur-[90px]" />
        <div className="absolute right-[8%] top-8 size-40 rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <motion.div
        variants={list}
        initial="hidden"
        animate="show"
        className="relative grid gap-6 pb-10"
      >
        <motion.header variants={item} className="grid gap-1 pt-10">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Account and public status.
          </p>
        </motion.header>

        <DataState
          loading={s.loading}
          error={s.loadError}
          data={s.profile ? [s.profile] : []}
          emptyTitle="No profile yet"
          onRetry={() => void s.reload().catch(() => {})}
          loadingComponent={<SettingsSkeleton />}
        >
          {() => (
            <>
              <motion.section variants={item} className="flex min-w-0 flex-col">
                <Card>
                  <CardHeader>
                    <CardTitleLabel icon={User}>Account</CardTitleLabel>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="settings-name">Display name</Label>
                        <Input
                          id="settings-name"
                          value={s.name}
                          onChange={(e) => s.setName(e.target.value)}
                          placeholder="Your name"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="settings-email">Email</Label>
                        <Input
                          id="settings-email"
                          value={s.email ?? ""}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="grid flex-1 gap-1.5">
                        <Label htmlFor="settings-tz">Reporting timezone</Label>
                        <Input
                          id="settings-tz"
                          value={s.timezone}
                          onChange={(e) => s.setTimezone(e.target.value)}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mx-2 sm:mb-0.5"
                        onClick={s.applyDeviceZone}
                      >
                        Use device timezone
                      </Button>
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                      <AnimatePresence>
                        {s.savedNote && (
                          <motion.p
                            key="saved-note"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-sm text-emerald-700 dark:text-emerald-400"
                          >
                            {s.savedNote}
                          </motion.p>
                        )}
                      </AnimatePresence>
                      {s.saveError && (
                        <p className="text-sm text-destructive">
                          {s.saveError}
                        </p>
                      )}
                      <Button
                        onClick={() => void s.save().catch(() => {})}
                        disabled={s.saving || !s.dirty}
                      >
                        {s.saving ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.section>

              <motion.section variants={item} className="flex min-w-0 flex-col">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitleLabel icon={Radio}>
                        Public status
                      </CardTitleLabel>
                      {s.statusSettings?.isPublic && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          <span className="relative flex size-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                          </span>
                          Live
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {!s.statusSettings ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-sm text-sm text-muted-foreground">
                          Share a private link that shows only whether
                          you&apos;re working, on a break, or offline.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void s.regenerate().catch(() => {})}
                          disabled={s.statusBusy}
                        >
                          {s.statusBusy ? "Generating…" : "Generate link"}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="grid gap-0.5">
                            <Label htmlFor="public-status-enabled">
                              Show my status publicly
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Never shares tasks, projects, or history.
                            </p>
                          </div>
                          <Switch
                            id="public-status-enabled"
                            size="sm"
                            checked={s.statusSettings.isPublic}
                            onCheckedChange={(checked) =>
                              void s.togglePublic(checked).catch(() => {})
                            }
                            disabled={s.statusBusy}
                          />
                        </div>
                        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-2">
                          <Radio className="size-3.5 shrink-0 text-muted-foreground" />
                          <code className="min-w-0 flex-1 break-all text-xs">
                            {s.statusUrl}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => void s.copyLink()}
                            aria-label="Copy link"
                          >
                            {s.copied ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            Updates every few minutes. A new link disables the
                            old one immediately.
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "Generate a new link? The current link stops working immediately.",
                                )
                              ) {
                                return;
                              }
                              void s.regenerate().catch(() => {});
                            }}
                            disabled={s.statusBusy}
                          >
                            <RefreshCw className="size-3.5" />
                            New link
                          </Button>
                        </div>
                      </>
                    )}
                    {s.statusError && (
                      <p className="text-sm text-destructive">
                        {s.statusError}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.section>
            </>
          )}
        </DataState>
      </motion.div>
    </div>
  );
}
